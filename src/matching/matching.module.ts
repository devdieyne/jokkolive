import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from '../schemas/comment.schema';
import { Order, OrderSchema } from '../schemas/order.schema';
import { Product, ProductSchema } from '../schemas/product.schema';
import { LiveSession, LiveSessionSchema } from '../schemas/live-session.schema';
import { MatchingService } from './matching.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: LiveSession.name, schema: LiveSessionSchema },
    ]),
  ],
  providers: [MatchingService],
})
export class MatchingModule {}
