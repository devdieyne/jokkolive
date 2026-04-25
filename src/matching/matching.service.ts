import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import OpenAI from 'openai';
import { Comment, CommentDocument, MatchStatus } from '../schemas/comment.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { LiveSession, LiveSessionDocument } from '../schemas/live-session.schema';
import { buildOrderDetectionPrompt } from './prompts/order-detection.prompt';

export interface CommentEvent {
  sellerId: string;
  sessionId: string;
  tiktokCommentId: string;
  author: {
    uniqueId: string;
    nickname: string;
    profilePicture: string;
  };
  content: string;
  timestamp: Date;
}

interface AiAnalysis {
  intent: MatchStatus;
  quantity: number;
  variants: Record<string, string>;
  buyerPhone: string | null;
  confidence: number;
  reasoning: string;
}

function isEmojiOnly(text: string): boolean {
  const withoutEmoji = text.replace(/\p{Emoji}/gu, '').trim();
  return withoutEmoji.length === 0;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventBus: EventEmitter2,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(LiveSession.name)
    private readonly liveModel: Model<LiveSessionDocument>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  @OnEvent('live.comment.received', { async: true })
  async handleComment(event: CommentEvent): Promise<void> {
    try {
      const session = await this.liveModel
        .findById(event.sessionId)
        .populate<{ currentProductId: ProductDocument | null }>(
          'currentProductId',
        )
        .exec();

      if (!session) return;

      const currentProduct = session.currentProductId;

      const comment = await this.commentModel.create({
        liveSessionId: new Types.ObjectId(event.sessionId),
        tiktokCommentId: event.tiktokCommentId,
        authorUniqueId: event.author.uniqueId,
        authorNickname: event.author.nickname,
        authorProfilePicture: event.author.profilePicture,
        content: event.content,
        contextProductId: currentProduct?._id,
        capturedAt: event.timestamp,
        matchStatus: 'pending',
      });

      if (!currentProduct) {
        comment.matchStatus = 'noise';
        await comment.save();
        return;
      }

      const content = event.content.trim();
      if (content.length < 2 || isEmojiOnly(content)) {
        comment.matchStatus = 'noise';
        await comment.save();
        return;
      }

      const analysis = await this.analyzeComment(event.content, currentProduct);

      comment.matchStatus = analysis.intent;

      if (analysis.intent === 'order_intent' && analysis.confidence > 0.5) {
        const validatedVariants = this.validateVariants(
          analysis.variants,
          currentProduct,
        );
        const hasInvalidVariants =
          Object.keys(analysis.variants).length > 0 &&
          Object.keys(validatedVariants).length <
            Object.keys(analysis.variants).length;

        const order = await this.createOrder({
          sellerId: event.sellerId,
          sessionId: event.sessionId,
          commentId: comment._id.toString(),
          buyerUsername: event.author.uniqueId,
          buyerPhone: analysis.buyerPhone,
          product: currentProduct,
          quantity: analysis.quantity,
          variants: validatedVariants,
          confidence: analysis.confidence,
          forceManualReview: hasInvalidVariants,
        });

        comment.resultingOrderId = order._id as Types.ObjectId;

        this.eventBus.emit('order.captured', {
          sellerId: event.sellerId,
          order: order.toObject(),
          buyer: event.author,
          confidence: analysis.confidence,
        });

        await this.liveModel.updateOne(
          { _id: event.sessionId },
          { $inc: { totalOrdersCaptured: 1 } },
        );
      }

      await comment.save();
    } catch (err) {
      this.logger.error(
        `Échec matching commentaire: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  private async analyzeComment(
    content: string,
    product: ProductDocument,
  ): Promise<AiAnalysis> {
    const model =
      this.configService.get<string>('openai.model') ?? 'gpt-4o-mini';

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: buildOrderDetectionPrompt(product),
          },
          {
            role: 'user',
            content: `Commentaire : "${content}"`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });

      const raw = JSON.parse(
        response.choices[0]?.message?.content ?? '{}',
      ) as Partial<AiAnalysis>;

      return {
        intent:
          raw.intent && ['order_intent', 'question', 'noise'].includes(raw.intent)
            ? raw.intent
            : 'noise',
        quantity: typeof raw.quantity === 'number' && raw.quantity >= 1 ? raw.quantity : 1,
        variants:
          raw.variants && typeof raw.variants === 'object' ? raw.variants : {},
        buyerPhone: raw.buyerPhone ?? null,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
        reasoning: raw.reasoning ?? '',
      };
    } catch (err) {
      this.logger.error(
        `Échec appel GPT: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        intent: 'failed',
        quantity: 1,
        variants: {},
        buyerPhone: null,
        confidence: 0,
        reasoning: 'Échec analyse IA',
      };
    }
  }

  private validateVariants(
    aiVariants: Record<string, string>,
    product: ProductDocument,
  ): Record<string, string> {
    const valid: Record<string, string> = {};
    for (const [name, value] of Object.entries(aiVariants)) {
      const productVariant = product.variants.find((v) => v.name === name);
      if (productVariant?.options.includes(value)) {
        valid[name] = value;
      }
    }
    return valid;
  }

  private async createOrder(params: {
    sellerId: string;
    sessionId: string;
    commentId: string;
    buyerUsername: string;
    buyerPhone: string | null;
    product: ProductDocument;
    quantity: number;
    variants: Record<string, string>;
    confidence: number;
    forceManualReview: boolean;
  }): Promise<OrderDocument> {
    const totalFCFA = params.product.priceFCFA * params.quantity;

    return this.orderModel.create({
      sellerId: params.sellerId,
      liveSessionId: new Types.ObjectId(params.sessionId),
      sourceCommentId: new Types.ObjectId(params.commentId),
      buyerTiktokUsername: params.buyerUsername,
      ...(params.buyerPhone ? { buyerPhone: params.buyerPhone } : {}),
      items: [
        {
          productId: params.product._id,
          productName: params.product.name,
          quantity: params.quantity,
          variant: new Map(Object.entries(params.variants)),
          unitPriceFCFA: params.product.priceFCFA,
        },
      ],
      totalFCFA,
      status: 'captured',
      matchConfidence: params.confidence,
      needsManualReview:
        params.confidence < 0.7 || params.forceManualReview,
    });
  }
}
