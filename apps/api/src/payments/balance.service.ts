import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SellerBalance,
  SellerBalanceDocument,
  ChargeProvider,
} from './schemas/seller-balance.schema';
import {
  BalanceTransaction,
  BalanceTransactionDocument,
} from './schemas/balance-transaction.schema';
import { PayoutDocument } from './schemas/payout.schema';
import {
  PaymentLink,
  PaymentLinkDocument,
} from '../schemas/payment-link.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { TransactionDetails } from './providers/payment-provider.interface';

const DEFAULT_FEE_FLAT = 50;
const DEFAULT_FEE_PERCENT = 0.02;

/**
 * Calcule les frais plateforme (50 XOF + 2%) — arrondi à l'entier.
 * Configurable via `PLATFORM_FEE_FLAT` / `PLATFORM_FEE_PERCENT`.
 */
function computeFee(
  amount: number,
  flat: number,
  percent: number,
): { fee: number; net: number } {
  const fee = flat + Math.round(amount * percent);
  const net = Math.max(0, amount - fee);
  return { fee, net };
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private readonly feeFlat: number;
  private readonly feePercent: number;

  constructor(
    @InjectModel(SellerBalance.name)
    private readonly balanceModel: Model<SellerBalanceDocument>,
    @InjectModel(BalanceTransaction.name)
    private readonly txModel: Model<BalanceTransactionDocument>,
    @InjectModel(PaymentLink.name)
    private readonly paymentLinkModel: Model<PaymentLinkDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly whatsapp: WhatsappService,
    private readonly configService: ConfigService,
  ) {
    const rawFlat = this.configService.get<string | number>(
      'PLATFORM_FEE_FLAT',
    );
    const rawPercent = this.configService.get<string | number>(
      'PLATFORM_FEE_PERCENT',
    );
    this.feeFlat =
      rawFlat === undefined || rawFlat === ''
        ? DEFAULT_FEE_FLAT
        : Number(rawFlat);
    this.feePercent =
      rawPercent === undefined || rawPercent === ''
        ? DEFAULT_FEE_PERCENT
        : Number(rawPercent);
  }

  computeFee(amount: number): { fee: number; net: number } {
    return computeFee(amount, this.feeFlat, this.feePercent);
  }

  async getOrCreateBalance(
    sellerId: Types.ObjectId | string,
    provider: ChargeProvider,
  ): Promise<SellerBalanceDocument> {
    const sellerObjId =
      typeof sellerId === 'string' ? new Types.ObjectId(sellerId) : sellerId;
    const existing = await this.balanceModel
      .findOne({ sellerId: sellerObjId, provider })
      .exec();
    if (existing) return existing;
    return this.balanceModel.create({
      sellerId: sellerObjId,
      provider,
      currency: 'XOF',
      available: 0,
      pending: 0,
    });
  }

  async listBalancesForSeller(
    sellerId: string,
  ): Promise<SellerBalanceDocument[]> {
    // Garantit qu'on a toujours les deux providers visibles côté UI.
    const wave = await this.getOrCreateBalance(sellerId, 'WAVE');
    const om = await this.getOrCreateBalance(sellerId, 'ORANGE_MONEY');
    return [wave, om];
  }

  async listTransactions(
    sellerId: string,
    provider: ChargeProvider,
    limit = 50,
  ): Promise<BalanceTransactionDocument[]> {
    return this.txModel
      .find({ sellerId: new Types.ObjectId(sellerId), provider })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .exec();
  }

  /**
   * Crédite le vendeur après paiement vérifié.
   * Idempotent par construction : l'appelant (webhook) doit avoir déjà
   * vérifié `link.status !== 'paid'` avant d'appeler.
   *
   * Pas de transaction Mongo : standalone Mongo en MVP. On écrit
   * séquentiellement et on log tout. Si un crash intervient au milieu,
   * `link.status === 'paid'` reste l'invariant qui empêche le double crédit.
   */
  async creditFromPayment(
    link: PaymentLinkDocument,
    tx: TransactionDetails,
  ): Promise<void> {
    const provider: ChargeProvider =
      link.paymentMethodUsed ?? tx.paymentMethod ?? 'WAVE';

    const { fee, net } = this.computeFee(link.amount);

    // 1. Marquer le PaymentLink payé en premier — c'est le verrou d'idempotence.
    link.status = 'paid';
    link.paidAt = new Date();
    link.platformFee = fee;
    link.sellerNet = net;
    link.externalRef = tx.id;
    link.paymentMethodUsed = provider;
    if (!link.psp) link.psp = 'diamanopay';
    await link.save();

    // 2. Marquer la commande payée.
    await this.orderModel
      .findByIdAndUpdate(link.orderId, {
        $set: { status: 'paid', paidAt: new Date() },
      })
      .exec();

    // 3. Incrémenter le solde vendeur.
    const balance = await this.getOrCreateBalance(link.sellerId, provider);
    balance.available += net;
    await balance.save();

    // 4. Ledger.
    await this.txModel.create({
      sellerId: link.sellerId,
      provider,
      type: 'credit',
      amount: net,
      availableAfter: balance.available,
      pendingAfter: balance.pending,
      relatedOrderId: link.orderId,
      description:
        net > 0
          ? `Paiement commande (frais ${fee} XOF retenus)`
          : `Paiement commande — montant trop faible, net=0 (frais ${fee} XOF)`,
    });

    this.logger.log(
      `credit sellerId=${link.sellerId.toString()} provider=${provider} amount=${link.amount} fee=${fee} net=${net}`,
    );

    // 5. Notifications WhatsApp non-bloquantes (vendeur + acheteur).
    try {
      const [seller, order] = await Promise.all([
        this.userModel.findById(link.sellerId).exec(),
        this.orderModel.findById(link.orderId).exec(),
      ]);
      const providerLabel = provider === 'WAVE' ? 'Wave' : 'Orange Money';

      // → Vendeur : récap complet pour identifier la commande sans ouvrir le dashboard.
      if (seller && order) {
        try {
          await this.whatsapp.sendText(
            seller.phone,
            [
              `✅ Paiement reçu — commande ${order.reference}`,
              ``,
              `Produit : ${order.productName} (${order.productCode})`,
              `Acheteur : ${order.buyerName ?? order.buyerPhone}`,
              `Numéro : ${order.buyerPhone}`,
              ``,
              `Montant : ${link.amount} XOF`,
              `Frais plateforme : ${fee} XOF`,
              `Crédité : ${net} XOF (${providerLabel})`,
              ``,
              `Solde dispo ${providerLabel} : ${balance.available} XOF`,
            ].join('\n'),
          );
        } catch (err) {
          this.logger.warn(
            `Notif vendeur échouée: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // → Acheteur : confirmation de paiement + référence pour son support.
      if (order && !order.buyerPhone.startsWith('lid:')) {
        try {
          await this.whatsapp.sendText(
            order.buyerPhone,
            [
              `✅ Paiement confirmé — commande ${order.reference}`,
              ``,
              `Produit : ${order.productName} (${order.productCode})`,
              `Montant payé : ${link.amount} XOF`,
              `Méthode : ${providerLabel}`,
              ``,
              `Merci ! Le vendeur a été notifié et va te contacter pour la livraison.`,
              `Garde la référence ${order.reference} pour toute question.`,
            ].join('\n'),
          );
        } catch (err) {
          this.logger.warn(
            `Notif acheteur échouée: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Notif paiement: lecture seller/order échouée: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Avant d'appeler le PSP : on déplace `amount` de `available` vers `pending`.
   */
  async debitForPayout(payout: PayoutDocument): Promise<void> {
    const balance = await this.getOrCreateBalance(
      payout.sellerId,
      payout.provider,
    );
    if (balance.available < payout.amount) {
      throw new NotFoundException('Solde insuffisant');
    }
    balance.available -= payout.amount;
    balance.pending += payout.amount;
    await balance.save();

    await this.txModel.create({
      sellerId: payout.sellerId,
      provider: payout.provider,
      type: 'debit',
      amount: payout.amount,
      availableAfter: balance.available,
      pendingAfter: balance.pending,
      relatedPayoutId: payout._id as Types.ObjectId,
      description: 'Lock pour retrait en cours',
    });
    this.logger.log(
      `debit-lock payoutId=${(payout._id as Types.ObjectId).toString()} amount=${payout.amount}`,
    );
  }

  /**
   * Le PSP a confirmé le payout : on consomme le pending (il disparaît).
   * `available` est déjà débité. Trace finale dans le ledger.
   */
  async confirmPayout(payout: PayoutDocument): Promise<void> {
    const balance = await this.getOrCreateBalance(
      payout.sellerId,
      payout.provider,
    );
    balance.pending = Math.max(0, balance.pending - payout.amount);
    await balance.save();

    await this.txModel.create({
      sellerId: payout.sellerId,
      provider: payout.provider,
      type: 'debit',
      amount: payout.amount,
      availableAfter: balance.available,
      pendingAfter: balance.pending,
      relatedPayoutId: payout._id as Types.ObjectId,
      description: 'Retrait confirmé par le PSP',
    });
    this.logger.log(
      `payout-confirm payoutId=${(payout._id as Types.ObjectId).toString()}`,
    );
  }

  /**
   * Rollback : le PSP a refusé / erreur. On rend le pending à available.
   */
  async reversePayout(
    payout: PayoutDocument,
    reason: string,
  ): Promise<void> {
    const balance = await this.getOrCreateBalance(
      payout.sellerId,
      payout.provider,
    );
    balance.pending = Math.max(0, balance.pending - payout.amount);
    balance.available += payout.amount;
    await balance.save();

    await this.txModel.create({
      sellerId: payout.sellerId,
      provider: payout.provider,
      type: 'reverse',
      amount: payout.amount,
      availableAfter: balance.available,
      pendingAfter: balance.pending,
      relatedPayoutId: payout._id as Types.ObjectId,
      description: `Retrait échoué : ${reason}`,
    });
    this.logger.log(
      `payout-reverse payoutId=${(payout._id as Types.ObjectId).toString()} reason=${reason}`,
    );
  }
}
