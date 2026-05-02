import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { ChargeProvider } from './schemas/seller-balance.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { BalanceService } from './balance.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './providers/payment-provider.interface';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectModel(Payout.name)
    private readonly payoutModel: Model<PayoutDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly balanceService: BalanceService,
    @Inject(PAYMENT_PROVIDER)
    private readonly psp: PaymentProvider,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsapp: WhatsappService,
  ) {}

  async listForSeller(
    sellerId: string,
    limit = 50,
  ): Promise<PayoutDocument[]> {
    return this.payoutModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .exec();
  }

  async requestPayout(
    sellerId: string,
    dto: { amount: number; provider: ChargeProvider },
  ): Promise<PayoutDocument> {
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }

    const user = await this.userModel.findById(sellerId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const account =
      dto.provider === 'WAVE'
        ? user.payoutAccounts?.wave
        : user.payoutAccounts?.orangeMoney;
    if (!account?.mobile) {
      throw new BadRequestException(
        `Aucun compte ${dto.provider === 'WAVE' ? 'Wave' : 'Orange Money'} configuré. Renseignez votre numéro dans les réglages.`,
      );
    }

    const balance = await this.balanceService.getOrCreateBalance(
      sellerId,
      dto.provider,
    );
    if (balance.available < dto.amount) {
      throw new BadRequestException(
        `Solde insuffisant : ${balance.available} XOF disponibles`,
      );
    }

    const clientReference = `JKPO-${sellerId.slice(-8)}-${randomUUID().slice(0, 8)}`;
    // Format : JKPO-{8 last digits of sellerId}-{8 chars UUID}
    // Exemple : JKPO-79bf9ea0-94b558d5 (max 24 chars) — DiamanoPay limite à 50

    const payout = await this.payoutModel.create({
      sellerId: new Types.ObjectId(sellerId),
      provider: dto.provider,
      amount: dto.amount,
      currency: 'XOF',
      mobile: account.mobile,
      psp: 'diamanopay',
      clientReference,
      status: 'pending',
    });

    // Lock du solde — si ça plante après ça mais avant l'appel PSP,
    // un job de réconciliation pourrait reverser. Pour MVP : on ne couvre
    // pas ce cas (très étroit).
    await this.balanceService.debitForPayout(payout);
    payout.status = 'processing';
    await payout.save();

    try {
      const result = await this.psp.createPayout({
        amount: dto.amount,
        mobile: account.mobile,
        provider: dto.provider,
        recipientName: user.displayName,
        description: 'Retrait JokkoLive',
        clientReference,
      });
      payout.status = 'success';
      payout.pspTransactionId = result.pspTransactionId;
      payout.pspProviderTransactionId = result.pspProviderTransactionId;
      payout.completedAt = new Date();
      await payout.save();
      await this.balanceService.confirmPayout(payout);
      this.logger.log(
        `payout-success sellerId=${sellerId} provider=${dto.provider} amount=${dto.amount} pspTx=${result.pspTransactionId}`,
      );
      return payout;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erreur inconnue';
      payout.status = 'failed';
      payout.failureReason = reason;
      await payout.save();
      try {
        await this.balanceService.reversePayout(payout, reason);
      } catch (rollbackErr) {
        this.logger.error(
          `Rollback payout échoué pour ${(payout._id as Types.ObjectId).toString()}: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
        );
      }
      this.logger.error(
        `payout-failed sellerId=${sellerId} provider=${dto.provider} amount=${dto.amount} reason=${reason}`,
      );
      throw new BadRequestException(`Retrait refusé : ${reason}`);
    }
  }

  /**
   * Retrait automatique déclenché juste après qu'un paiement a crédité le
   * solde du vendeur. Ne fait rien si :
   *  - `autoPayoutEnabled` est false
   *  - le compte mobile money correspondant au provider n'est pas configuré
   *  - le montant est ≤ 0
   *
   * En cas d'échec PSP, `requestPayout` reverse déjà le solde (l'argent
   * reste disponible) — on ajoute ici une notif WhatsApp au vendeur ET aux
   * admins pour qu'ils soient au courant.
   *
   * Cette méthode ne throw JAMAIS : elle est appelée en fire-and-forget
   * depuis le webhook PSP, qui ne doit pas voir ses 200 OK retardés ou
   * cassés par un souci de retrait.
   */
  async triggerAutoPayout(
    sellerId: string,
    amount: number,
    provider: ChargeProvider,
  ): Promise<void> {
    if (!Number.isInteger(amount) || amount <= 0) return;

    const user = await this.userModel.findById(sellerId).exec();
    if (!user) {
      this.logger.warn(`auto-payout: user ${sellerId} introuvable`);
      return;
    }
    if (!user.autoPayoutEnabled) return;

    const account =
      provider === 'WAVE'
        ? user.payoutAccounts?.wave
        : user.payoutAccounts?.orangeMoney;
    if (!account?.mobile) {
      // Auto-payout activé mais compte non configuré → on log et on laisse
      // l'argent dans le solde. On ne notifie pas (c'est de la config
      // utilisateur, le user le verra dans Settings).
      this.logger.warn(
        `auto-payout skipped: sellerId=${sellerId} provider=${provider} compte non configuré`,
      );
      return;
    }

    try {
      const payout = await this.requestPayout(sellerId, { amount, provider });
      this.logger.log(
        `auto-payout-success sellerId=${sellerId} provider=${provider} amount=${amount} payoutId=${(payout._id as Types.ObjectId).toString()}`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `auto-payout-failed sellerId=${sellerId} provider=${provider} amount=${amount} reason=${reason}`,
      );
      // Notifications fire-and-forget — ne jamais throw depuis ici.
      void this.notifyAutoPayoutFailure(user, amount, provider, reason).catch(
        (notifErr) =>
          this.logger.error(
            `notif auto-payout failure échouée: ${notifErr instanceof Error ? notifErr.message : String(notifErr)}`,
          ),
      );
    }
  }

  /**
   * Envoie 2 notifications WhatsApp en cas d'échec d'un retrait automatique :
   *  - au vendeur : "argent toujours disponible, retire manuellement"
   *  - aux admins : alerte avec contexte pour intervenir
   *
   * Limitation Meta : si le destinataire n'a pas écrit au numéro business
   * dans les 24h, l'envoi sera refusé par Cloud API. On catch silencieusement
   * — la perte de la notif n'est pas critique (le solde reste OK et le
   * retrait manuel reste accessible depuis le dashboard).
   */
  private async notifyAutoPayoutFailure(
    seller: UserDocument,
    amount: number,
    provider: ChargeProvider,
    reason: string,
  ): Promise<void> {
    const providerLabel = provider === 'WAVE' ? 'Wave' : 'Orange Money';

    // → Vendeur
    try {
      await this.whatsapp.sendText(
        seller.phone,
        [
          `⚠️ Retrait automatique échoué`,
          ``,
          `Nous n'avons pas pu envoyer ${amount} XOF sur votre compte ${providerLabel}.`,
          `Votre argent est toujours disponible — vous pouvez le retirer manuellement depuis votre tableau de bord JokkoLive.`,
          ``,
          `Si le problème persiste, contactez le support.`,
        ].join('\n'),
      );
    } catch (err) {
      this.logger.warn(
        `notif vendeur auto-payout failure échouée pour ${seller.phone}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // → Admins (tous ceux avec role=admin)
    const admins = await this.userModel.find({ role: 'admin' }).exec();
    for (const admin of admins) {
      try {
        await this.whatsapp.sendText(
          admin.phone,
          [
            `🚨 Auto-payout échoué`,
            ``,
            `Vendeur : ${seller.displayName} (@${seller.pseudo})`,
            `Téléphone : ${seller.phone}`,
            `Montant : ${amount} XOF (${providerLabel})`,
            `Raison : ${reason}`,
            ``,
            `Le solde du vendeur a été restauré, il peut retirer manuellement.`,
          ].join('\n'),
        );
      } catch (err) {
        this.logger.warn(
          `notif admin ${admin.phone} échouée: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
