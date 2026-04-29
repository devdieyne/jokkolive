import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  PaymentLink,
  PaymentLinkDocument,
} from '../schemas/payment-link.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  PAYMENT_PROVIDER,
  type ChargeProvider,
  type PaymentProvider,
} from './providers/payment-provider.interface';
import { UpdatePayoutAccountsDto } from './dto/update-payout-accounts.dto';

const DEFAULT_EXPIRY_HOURS = 24;

interface CreateLinkInput {
  orderId: Types.ObjectId;
  sellerId: Types.ObjectId;
  amount: number;
  currency: string;
}

export interface InitiateCheckoutResult {
  paymentUrl: string;
  qrCodeData?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly publicBaseUrl: string;

  constructor(
    @InjectModel(PaymentLink.name)
    private readonly paymentLinkModel: Model<PaymentLinkDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_PROVIDER)
    private readonly psp: PaymentProvider,
  ) {
    this.publicBaseUrl =
      this.configService.get<string>('PUBLIC_BASE_URL') ??
      'http://localhost:5173';
  }

  private generateToken(): string {
    return randomUUID().replace(/-/g, '');
  }

  buildUrl(token: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/pay/${token}`;
  }

  async createLink(input: CreateLinkInput): Promise<PaymentLinkDocument> {
    const expiresAt = new Date(
      Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000,
    );
    return this.paymentLinkModel.create({
      token: this.generateToken(),
      orderId: input.orderId,
      sellerId: input.sellerId,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      expiresAt,
    });
  }

  async getByToken(token: string): Promise<PaymentLinkDocument> {
    const link = await this.paymentLinkModel.findOne({ token }).exec();
    if (!link) throw new NotFoundException('Lien de paiement introuvable');

    if (link.status === 'pending' && link.expiresAt.getTime() < Date.now()) {
      link.status = 'expired';
      await link.save();
    }
    return link;
  }

  async findByPspChargeId(
    pspChargeId: string,
  ): Promise<PaymentLinkDocument | null> {
    return this.paymentLinkModel.findOne({ pspChargeId }).exec();
  }

  async markPaid(
    token: string,
    sellerId: string,
    externalRef?: string,
  ): Promise<PaymentLinkDocument> {
    const link = await this.getByToken(token);
    if (link.sellerId.toString() !== sellerId) {
      throw new ForbiddenException('Ce paiement ne vous appartient pas');
    }
    if (link.status === 'paid') return link;
    if (link.status !== 'pending') {
      throw new BadRequestException(`Lien ${link.status}, action impossible`);
    }
    link.status = 'paid';
    link.paidAt = new Date();
    if (externalRef) link.externalRef = externalRef;
    return link.save();
  }

  async findByOrderId(
    orderId: Types.ObjectId,
  ): Promise<PaymentLinkDocument | null> {
    return this.paymentLinkModel.findOne({ orderId }).exec();
  }

  /**
   * Démarre une charge auprès du PSP pour un PaymentLink.
   * Idempotent : si une charge existe déjà avec le bon provider, on
   * renvoie l'URL stockée sans rappeler DiamanoPay. Si l'utilisateur
   * change de provider, on recrée une charge.
   *
   * `paymentUrl` est stocké dans `externalRef` (au lieu d'une nouvelle
   * colonne) — c'est le seul champ texte libre du schéma.
   */
  async initiateCheckout(
    token: string,
    provider: ChargeProvider,
  ): Promise<InitiateCheckoutResult> {
    const link = await this.getByToken(token);

    if (link.status !== 'pending') {
      throw new BadRequestException(
        `Ce lien est ${link.status}, paiement impossible`,
      );
    }
    if (link.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Ce lien a expiré');
    }

    if (
      link.pspChargeId &&
      link.paymentMethodUsed === provider &&
      link.externalRef
    ) {
      return { paymentUrl: link.externalRef };
    }

    const order = await this.orderModel.findById(link.orderId).exec();
    const orderCode = order?.productCode ?? link.orderId.toString().slice(-6);

    const charge = await this.psp.createCharge({
      amount: link.amount,
      currency: 'XOF',
      provider,
      description: `Commande JokkoLive ${orderCode}`,
      clientReference: `JK-${link.orderId.toString()}-${link.token}`,
      redirectUrl: this.buildUrl(link.token),
      webhookUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/api/webhooks/diamanopay`,
      extraData: {
        paymentLinkToken: link.token,
        sellerId: link.sellerId.toString(),
        orderId: link.orderId.toString(),
      },
    });

    link.psp = 'diamanopay';
    link.pspChargeId = charge.pspChargeId;
    link.paymentMethodUsed = provider;
    link.externalRef = charge.paymentUrl;
    await link.save();

    this.logger.log(
      `charge-created token=${link.token} provider=${provider} chargeId=${charge.pspChargeId} amount=${link.amount}`,
    );

    return {
      paymentUrl: charge.paymentUrl,
      qrCodeData: charge.qrCodeData,
    };
  }

  async updatePayoutAccounts(
    userId: string,
    dto: UpdatePayoutAccountsDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const current = user.payoutAccounts ?? {};
    const next: NonNullable<UserDocument['payoutAccounts']> = {
      wave: current.wave,
      orangeMoney: current.orangeMoney,
    };
    if (dto.wave) next.wave = { mobile: dto.wave.mobile };
    if (dto.orangeMoney) next.orangeMoney = { mobile: dto.orangeMoney.mobile };
    user.payoutAccounts = next;
    await user.save();
    return user;
  }
}
