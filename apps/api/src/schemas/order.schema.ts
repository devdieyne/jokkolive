import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order> & {
  createdAt: Date;
  updatedAt: Date;
};

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

/**
 * Commande créée à la réception d'un message WhatsApp `@pseudo:CODE`.
 * Une commande possède un PaymentLink associé (relation 1-1).
 */
@Schema({ timestamps: true })
export class Order {
  /**
   * Référence courte et lisible pour l'humain — ex: `JK-A3F2K7`.
   * Affichée dans les messages WhatsApp (vendeur + acheteur) et dans
   * le dashboard. Unique. Générée à la création (cf. OrdersService).
   */
  @Prop({ required: true, unique: true, index: true })
  reference!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  productId!: Types.ObjectId;

  /** Snapshot du nom au moment de la commande (au cas où le produit est renommé). */
  @Prop({ required: true })
  productName!: string;

  /** Snapshot du code (R1, C2…). */
  @Prop({ required: true })
  productCode!: string;

  @Prop({ required: true, default: 1, min: 1 })
  quantity!: number;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ required: true })
  currency!: string;

  /** Numéro WhatsApp de l'acheteur (E.164) — extrait du webhook WAHA. */
  @Prop({ required: true, index: true })
  buyerPhone!: string;

  /** Nom WA de l'acheteur si fourni par WAHA (pushName). */
  @Prop()
  buyerName?: string;

  /** Message brut reçu sur WhatsApp (`@abou:R1`). */
  @Prop({ required: true })
  rawMessage!: string;

  @Prop({
    enum: ['pending', 'paid', 'cancelled', 'expired'],
    default: 'pending',
    index: true,
  })
  status!: OrderStatus;

  /** Lien de paiement associé (rempli juste après la création). */
  @Prop({ type: Types.ObjectId, ref: 'PaymentLink' })
  paymentLinkId?: Types.ObjectId;

  /** Date de paiement (passé à 'paid'). */
  @Prop()
  paidAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
