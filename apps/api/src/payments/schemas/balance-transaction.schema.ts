import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { ChargeProvider } from './seller-balance.schema';

export type BalanceTransactionType = 'credit' | 'debit' | 'reverse';

export type BalanceTransactionDocument = HydratedDocument<BalanceTransaction> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Ledger append-only des mouvements de solde.
 * `amount` est TOUJOURS positif — `type` porte le signe.
 * Les snapshots `availableAfter`/`pendingAfter` figent le solde après écriture
 * pour audit & affichage rapide sans recalcul.
 */
@Schema({ timestamps: true })
export class BalanceTransaction {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true, enum: ['WAVE', 'ORANGE_MONEY'] })
  provider!: ChargeProvider;

  @Prop({ required: true, enum: ['credit', 'debit', 'reverse'] })
  type!: BalanceTransactionType;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 0 })
  availableAfter!: number;

  @Prop({ required: true, default: 0 })
  pendingAfter!: number;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  relatedOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payout' })
  relatedPayoutId?: Types.ObjectId;

  @Prop({ required: true })
  description!: string;
}

export const BalanceTransactionSchema =
  SchemaFactory.createForClass(BalanceTransaction);
BalanceTransactionSchema.index({ sellerId: 1, provider: 1, createdAt: -1 });
