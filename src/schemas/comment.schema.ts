import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment> & {
  createdAt: Date;
  updatedAt: Date;
};

export type MatchStatus =
  | 'pending'
  | 'order_intent'
  | 'question'
  | 'noise'
  | 'failed';

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true })
  liveSessionId!: Types.ObjectId;

  @Prop({ required: true })
  tiktokCommentId!: string;

  @Prop({ required: true })
  authorUniqueId!: string;

  @Prop()
  authorNickname?: string;

  @Prop()
  authorProfilePicture?: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  contextProductId?: Types.ObjectId;

  @Prop({
    enum: ['pending', 'order_intent', 'question', 'noise', 'failed'],
    default: 'pending',
  })
  matchStatus!: MatchStatus;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  resultingOrderId!: Types.ObjectId | null;

  @Prop({ required: true })
  capturedAt!: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index(
  { liveSessionId: 1, tiktokCommentId: 1 },
  { unique: true },
);
