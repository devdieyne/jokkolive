import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { ChargeProvider } from './seller-balance.schema';

export type PayoutStatus = 'pending' | 'processing' | 'success' | 'failed';

export type PayoutDocument = HydratedDocument<Payout> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Demande de retrait (mobile money) déclenchée par un vendeur.
 *
 * Le flux est synchrone côté DiamanoPay : on appelle `POST /api/payout`
 * et on se fie au champ `success` de la réponse. Si succès, on consume
 * le pending. Sinon on rembourse en `available` (reverse).
 *
 * `clientReference` est notre clé d'idempotence (générée par nous).
 */
@Schema({ timestamps: true })
export class Payout {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true, enum: ['WAVE', 'ORANGE_MONEY'] })
  provider!: ChargeProvider;

  @Prop({ required: true, min: 1 })
  amount!: number;

  @Prop({ required: true, default: 'XOF' })
  currency!: 'XOF';

  /** 9 chiffres locaux (Sénégal) — sans indicatif. */
  @Prop({ required: true })
  mobile!: string;

  @Prop({ required: true, default: 'diamanopay' })
  psp!: 'diamanopay';

  @Prop({ required: true, unique: true, index: true })
  clientReference!: string;

  @Prop({
    required: true,
    enum: ['pending', 'processing', 'success', 'failed'],
    default: 'pending',
    index: true,
  })
  status!: PayoutStatus;

  @Prop()
  pspTransactionId?: string;

  @Prop()
  pspProviderTransactionId?: string;

  @Prop()
  failureReason?: string;

  @Prop()
  completedAt?: Date;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);
