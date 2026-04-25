import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from 'tiktok-live-connector';
import { LiveSession, LiveSessionDocument } from '../schemas/live-session.schema';

@Injectable()
export class LiveService implements OnModuleDestroy {
  private readonly logger = new Logger(LiveService.name);
  private readonly connections = new Map<string, TikTokLiveConnection>();
  private readonly stoppingSellerIds = new Set<string>();

  constructor(
    private readonly eventBus: EventEmitter2,
    @InjectModel(LiveSession.name)
    private readonly liveModel: Model<LiveSessionDocument>,
  ) {}

  async startLive(
    sellerId: string,
    tiktokUsername: string,
  ): Promise<LiveSessionDocument> {
    if (this.connections.has(sellerId)) {
      await this.stopLive(sellerId);
    }

    const session = await this.liveModel.create({
      sellerId,
      tiktokUsername: tiktokUsername.replace('@', ''),
      status: 'active',
      startedAt: new Date(),
    });

    try {
      await this.connectToTikTok(session, sellerId);
      return session;
    } catch (err) {
      session.status = 'failed';
      await session.save();
      throw new Error(
        `Connexion TikTok échouée : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async stopLive(sellerId: string): Promise<void> {
    const connection = this.connections.get(sellerId);
    if (!connection) return;

    this.stoppingSellerIds.add(sellerId);
    await connection.disconnect();
    this.connections.delete(sellerId);

    const session = await this.liveModel.findOneAndUpdate(
      { sellerId, status: 'active' },
      { status: 'ended', endedAt: new Date() },
    );

    if (session) {
      this.eventBus.emit('live.ended', {
        sellerId,
        sessionId: session._id.toString(),
      });
    }
  }

  async setCurrentProduct(sellerId: string, productId: string): Promise<void> {
    const session = await this.liveModel.findOneAndUpdate(
      { sellerId, status: 'active' },
      { currentProductId: new Types.ObjectId(productId) },
    );

    if (!session) throw new BadRequestException('No active live session');

    this.eventBus.emit('live.product.changed', { sellerId, productId });
  }

  async getActiveSession(sellerId: string): Promise<LiveSessionDocument | null> {
    return this.liveModel.findOne({ sellerId, status: 'active' }).exec();
  }

  async getSessions(
    sellerId: string,
    limit = 10,
    skip = 0,
  ): Promise<LiveSessionDocument[]> {
    return this.liveModel
      .find({ sellerId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  private async connectToTikTok(
    session: LiveSessionDocument,
    sellerId: string,
  ): Promise<void> {
    const connection = new TikTokLiveConnection(session.tiktokUsername, {
      processInitialData: false,
      requestPollingIntervalMs: 2000,
    });

    connection.on(WebcastEvent.CHAT, (data) => {
      const msgId = data.common?.msgId ?? '';
      const uniqueId = data.user?.uniqueId ?? '';

      this.logger.debug(`💬 [@${uniqueId}] ${data.comment}`);

      this.eventBus.emit('live.comment.received', {
        sellerId,
        sessionId: session._id.toString(),
        tiktokCommentId: msgId,
        author: {
          uniqueId,
          nickname: data.user?.nickname ?? '',
          profilePicture: data.user?.profilePicture?.url[0] ?? '',
        },
        content: data.comment,
        timestamp: new Date(),
      });

      void this.liveModel.updateOne(
        { _id: session._id },
        { $inc: { totalComments: 1 } },
      );
    });

    connection.on(WebcastEvent.GIFT, (data) => {
      this.eventBus.emit('live.gift.received', {
        sellerId,
        sessionId: session._id.toString(),
        from: data.user?.uniqueId ?? '',
        diamonds: data.giftDetails?.diamondCount ?? 0,
        giftName: data.giftDetails?.giftName ?? '',
      });
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      if (this.stoppingSellerIds.has(sellerId)) {
        this.stoppingSellerIds.delete(sellerId);
        return;
      }

      this.logger.warn(`🔌 Déconnecté @${session.tiktokUsername}`);
      this.connections.delete(sellerId);
      this.eventBus.emit('live.disconnected', { sellerId });

      setTimeout(
        () =>
          this.reconnectSession(
            sellerId,
            session._id.toString(),
            session.tiktokUsername,
            0,
          ),
        5000,
      );
    });

    const state = await connection.connect();

    session.roomId = state.roomId;
    await session.save();

    this.connections.set(sellerId, connection);

    this.eventBus.emit('live.connected', {
      sellerId,
      sessionId: session._id.toString(),
      roomId: state.roomId,
    });
  }

  private async reconnectSession(
    sellerId: string,
    sessionId: string,
    username: string,
    attempt: number,
  ): Promise<void> {
    if (attempt >= 5) {
      this.logger.error(
        `Reconnexion abandonnée pour @${username} après 5 tentatives`,
      );
      await this.liveModel.findByIdAndUpdate(sessionId, { status: 'failed' });
      this.eventBus.emit('live.failed', {
        sellerId,
        error: 'Max reconnect attempts reached',
      });
      return;
    }

    const session = await this.liveModel.findById(sessionId);
    if (!session || session.status !== 'active') return;

    this.logger.log(
      `♻️ Reconnexion tentative ${attempt + 1}/5 @${username}`,
    );

    try {
      await this.connectToTikTok(session, sellerId);
    } catch {
      const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
      this.logger.warn(`Retry dans ${delay}ms...`);
      setTimeout(
        () => this.reconnectSession(sellerId, sessionId, username, attempt + 1),
        delay,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    const disconnects = [...this.connections.entries()].map(
      async ([sid, conn]) => {
        this.stoppingSellerIds.add(sid);
        await conn.disconnect();
      },
    );
    await Promise.all(disconnects);
  }
}
