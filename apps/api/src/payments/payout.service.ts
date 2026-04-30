import {
  BadRequestException,
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
}
