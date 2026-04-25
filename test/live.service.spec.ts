import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { LiveService } from '../src/live/live.service';
import { LiveSession } from '../src/schemas/live-session.schema';

const mockSession = {
  _id: '507f1f77bcf86cd799439011',
  sellerId: 'default-seller',
  tiktokUsername: 'test_user',
  status: 'active',
  roomId: undefined as string | undefined,
  save: jest.fn().mockResolvedValue(undefined),
  updateOne: jest.fn().mockResolvedValue(undefined),
};

const mockLiveModel = {
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
};

const mockEventBus = {
  emit: jest.fn(),
};

jest.mock('tiktok-live-connector', () => ({
  TikTokLiveConnection: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue({ roomId: 'room_123', isConnected: true }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
  WebcastEvent: {
    CHAT: 'chat',
    GIFT: 'gift',
  },
  ControlEvent: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
  },
}));

describe('LiveService', () => {
  let service: LiveService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveService,
        { provide: getModelToken(LiveSession.name), useValue: mockLiveModel },
        { provide: EventEmitter2, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<LiveService>(LiveService);
  });

  describe('startLive', () => {
    it('crée une session et émet live.connected', async () => {
      mockLiveModel.create.mockResolvedValue({ ...mockSession });

      const session = await service.startLive('default-seller', 'test_user');

      expect(mockLiveModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: 'default-seller',
          tiktokUsername: 'test_user',
          status: 'active',
        }),
      );
      expect(session).toBeDefined();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'live.connected',
        expect.objectContaining({ sellerId: 'default-seller', roomId: 'room_123' }),
      );
    });

    it('supprime le @ du username', async () => {
      mockLiveModel.create.mockResolvedValue({ ...mockSession });

      await service.startLive('default-seller', '@test_user');

      expect(mockLiveModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ tiktokUsername: 'test_user' }),
      );
    });

    it('marque la session failed si la connexion TikTok échoue', async () => {
      const failSession = { ...mockSession, status: 'active', save: jest.fn() };
      mockLiveModel.create.mockResolvedValue(failSession);

      const { TikTokLiveConnection } = jest.requireMock('tiktok-live-connector') as {
        TikTokLiveConnection: jest.Mock;
      };
      TikTokLiveConnection.mockImplementationOnce(() => ({
        on: jest.fn(),
        connect: jest.fn().mockRejectedValue(new Error('Utilisateur pas en live')),
        disconnect: jest.fn(),
      }));

      await expect(
        service.startLive('default-seller', 'offline_user'),
      ).rejects.toThrow('Connexion TikTok échouée');

      expect(failSession.status).toBe('failed');
      expect(failSession.save).toHaveBeenCalled();
    });
  });

  describe('stopLive', () => {
    it('est idempotent si aucune connexion active', async () => {
      await expect(service.stopLive('unknown-seller')).resolves.toBeUndefined();
      expect(mockLiveModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('ferme la connexion et émet live.ended', async () => {
      mockLiveModel.create.mockResolvedValue({ ...mockSession });
      await service.startLive('default-seller', 'test_user');

      mockLiveModel.findOneAndUpdate.mockResolvedValue({
        ...mockSession,
        _id: { toString: () => '507f1f77bcf86cd799439011' },
      });

      await service.stopLive('default-seller');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'live.ended',
        expect.objectContaining({ sellerId: 'default-seller' }),
      );
    });
  });

  describe('setCurrentProduct', () => {
    it('lance BadRequestException si pas de session active', async () => {
      mockLiveModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.setCurrentProduct('default-seller', '507f1f77bcf86cd799439022'),
      ).rejects.toThrow(BadRequestException);
    });

    it('émet live.product.changed quand la session existe', async () => {
      mockLiveModel.findOneAndUpdate.mockResolvedValue({ ...mockSession });

      await service.setCurrentProduct('default-seller', '507f1f77bcf86cd799439022');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'live.product.changed',
        { sellerId: 'default-seller', productId: '507f1f77bcf86cd799439022' },
      );
    });
  });

  describe('getActiveSession', () => {
    it('retourne null si aucune session active', async () => {
      mockLiveModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.getActiveSession('default-seller');
      expect(result).toBeNull();
    });
  });

  describe('getSessions', () => {
    it('applique la pagination par défaut', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockLiveModel.find.mockReturnValue(mockQuery);

      await service.getSessions('default-seller');

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
    });
  });
});
