import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order> & {
  createdAt: Date;
  updatedAt: Date;
};

export type OrderStatus = 'captured' | 'confirmed' | 'cancelled';

export interface OrderItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  variant: Map<string, string>;
  unitPriceFCFA: number;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  sellerId!: string;

  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true })
  liveSessionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', required: true })
  sourceCommentId!: Types.ObjectId;

  @Prop({ required: true })
  buyerTiktokUsername!: string;

  @Prop()
  buyerPhone?: string;

  @Prop({
    type: [
      {
        productId: { type: Types.ObjectId, ref: 'Product' },
        productName: String,
        quantity: Number,
        variant: { type: Map, of: String },
        unitPriceFCFA: Number,
      },
    ],
    default: [],
  })
  items!: OrderItem[];

  @Prop({ required: true })
  totalFCFA!: number;

  @Prop({
    enum: ['captured', 'confirmed', 'cancelled'],
    default: 'captured',
  })
  status!: OrderStatus;

  @Prop({ default: 0 })
  matchConfidence!: number;

  @Prop({ default: false })
  needsManualReview!: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
