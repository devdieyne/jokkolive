import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface SellerJoinPayload {
  sellerId: string;
}

@WebSocketGateway({
  namespace: '/live',
  cors: { origin: '*' },
})
export class EventsGateway {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('seller:join')
  handleSellerJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SellerJoinPayload,
  ) {
    void client.join(`seller:${data.sellerId}`);
    this.logger.log(`Client rejoint room seller:${data.sellerId}`);
    return { status: 'joined', sellerId: data.sellerId };
  }

  @OnEvent('live.connected')
  handleLiveConnected(payload: { sellerId: string; roomId: string }) {
    this.server
      .to(`seller:${payload.sellerId}`)
      .emit('live:status', { status: 'connected', roomId: payload.roomId });
  }

  @OnEvent('live.disconnected')
  handleLiveDisconnected(payload: { sellerId: string }) {
    this.server
      .to(`seller:${payload.sellerId}`)
      .emit('live:status', { status: 'disconnected' });
  }

  @OnEvent('live.comment.received')
  handleCommentReceived(payload: {
    sellerId: string;
    author: { uniqueId: string; nickname: string };
    content: string;
    timestamp: Date;
  }) {
    this.server.to(`seller:${payload.sellerId}`).emit('live:comment', {
      author: payload.author,
      content: payload.content,
      timestamp: payload.timestamp,
    });
  }

  @OnEvent('order.captured')
  handleOrderCaptured(payload: {
    sellerId: string;
    order: Record<string, unknown>;
    buyer: { uniqueId: string; nickname: string };
    confidence: number;
  }) {
    this.server.to(`seller:${payload.sellerId}`).emit('order:new', {
      order: payload.order,
      buyer: payload.buyer,
      confidence: payload.confidence,
      needsReview: payload.confidence < 0.7,
    });
  }

  @OnEvent('live.product.changed')
  handleProductChanged(payload: { sellerId: string; productId: string }) {
    this.server
      .to(`seller:${payload.sellerId}`)
      .emit('live:product-changed', { productId: payload.productId });
  }

  @OnEvent('live.ended')
  handleLiveEnded(payload: { sellerId: string; sessionId: string }) {
    this.server
      .to(`seller:${payload.sellerId}`)
      .emit('live:ended', { sessionId: payload.sessionId });
  }
}
