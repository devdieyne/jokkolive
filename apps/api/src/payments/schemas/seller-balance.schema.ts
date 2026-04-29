import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChargeProvider = 'WAVE' | 'ORANGE_MONEY';

export type SellerBalanceDocument = HydratedDocument<SellerBalance> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Solde interne d'un vendeur, séparé par provider mobile money.
 * Un document par couple (sellerId, provider).
 *
 * - `available` : montant payable immédiatement (XOF).
 * - `pending`   : montant locké pendant un payout en cours. Il revient
 *                 à `available` si le payout échoue (rollback).
 */
@Schema({ timestamps: true })
export class SellerBalance {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true, enum: ['WAVE', 'ORANGE_MONEY'] })
  provider!: ChargeProvider;

  @Prop({ required: true, default: 'XOF' })
  currency!: 'XOF';

  @Prop({ required: true, default: 0, min: 0 })
  available!: number;

  @Prop({ required: true, default: 0, min: 0 })
  pending!: number;
}

export const SellerBalanceSchema = SchemaFactory.createForClass(SellerBalance);
SellerBalanceSchema.index({ sellerId: 1, provider: 1 }, { unique: true });
