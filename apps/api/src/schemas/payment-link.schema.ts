import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentLinkDocument = HydratedDocument<PaymentLink> & {
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentLinkStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

/**
 * Lien de paiement unique généré pour chaque commande WhatsApp.
 * URL publique : `${PUBLIC_BASE_URL}/pay/${token}`.
 *
 * Pour l'instant le paiement réel n'est pas branché : le vendeur peut
 * marquer la commande comme payée manuellement, ce qui flippe ce lien.
 * Préparé pour intégration future Wave / Orange Money / Stripe.
 */
@Schema({ timestamps: true })
export class PaymentLink {
  /** Token slug unique dans l'URL — UUID v4 sans tirets. */
  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Order', unique: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  currency!: string;

  @Prop({
    enum: ['pending', 'paid', 'expired', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status!: PaymentLinkStatus;

  /** Expiration (24h par défaut). */
  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  paidAt?: Date;

  /** Référence externe du PSP (Wave/OM/Stripe) — quand on intégrera. */
  @Prop()
  externalRef?: string;

  // ── Intégration PSP ────────────────────────────────────────────────────────

  @Prop({ enum: ['diamanopay'] })
  psp?: 'diamanopay';

  @Prop({ index: true })
  pspChargeId?: string;

  @Prop({ enum: ['WAVE', 'ORANGE_MONEY'] })
  paymentMethodUsed?: 'WAVE' | 'ORANGE_MONEY';

  /** Frais plateforme retenus au crédit (50 + 2%). */
  @Prop()
  platformFee?: number;

  /** Net crédité au vendeur = amount - platformFee. */
  @Prop()
  sellerNet?: number;
}

export const PaymentLinkSchema = SchemaFactory.createForClass(PaymentLink);
