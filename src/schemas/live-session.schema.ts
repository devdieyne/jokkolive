import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LiveSessionDocument = HydratedDocument<LiveSession> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class LiveSession {
  @Prop({ required: true })
  sellerId!: string;

  @Prop({ required: true })
  tiktokUsername!: string;

  @Prop()
  roomId?: string;

  @Prop({ enum: ['active', 'ended', 'failed'], default: 'active' })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'Product', default: null })
  currentProductId!: Types.ObjectId | null;

  @Prop({ default: Date.now })
  startedAt!: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ default: 0 })
  totalComments!: number;

  @Prop({ default: 0 })
  totalOrdersCaptured!: number;
}

export const LiveSessionSchema = SchemaFactory.createForClass(LiveSession);
