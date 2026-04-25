import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MatchingService, CommentEvent } from '../src/matching/matching.service';
import { Comment } from '../src/schemas/comment.schema';
import { Order } from '../src/schemas/order.schema';
import { Product } from '../src/schemas/product.schema';
import { LiveSession } from '../src/schemas/live-session.schema';
import { Types } from 'mongoose';

const mockProduct = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439022'),
  sellerId: 'default-seller',
  name: 'Robe wax',
  priceFCFA: 15000,
  keywords: ['robe', 'wax'],
  variants: [
    { name: 'taille', options: ['S', 'M', 'L'] },
    { name: 'couleur', options: ['rouge', 'bleu'] },
  ],
  stock: 10,
};

const mockSession = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  sellerId: 'default-seller',
  tiktokUsername: 'test_user',
  status: 'active',
  currentProductId: mockProduct,
};

const mockComment = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439033'),
  matchStatus: 'pending',
  resultingOrderId: null,
  save: jest.fn().mockResolvedValue(undefined),
};

const mockOrder = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439044'),
  toObject: jest.fn().mockReturnValue({ id: '507f1f77bcf86cd799439044' }),
};

const mockCommentModel = {
  create: jest.fn(),
};

const mockOrderModel = {
  create: jest.fn(),
};

const mockProductModel = {};

const mockLiveModel = {
  findById: jest.fn(),
  updateOne: jest.fn(),
};

const mockEventBus = {
  emit: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'openai.apiKey') return 'test-key';
    if (key === 'openai.model') return 'gpt-4o-mini';
    return undefined;
  }),
};

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockOpenAI),
}));

describe('MatchingService', () => {
  let service: MatchingService;

  const baseEvent: CommentEvent = {
    sellerId: 'default-seller',
    sessionId: '507f1f77bcf86cd799439011',
    tiktokCommentId: 'msg_001',
    author: {
      uniqueId: 'acheteur_dakar',
      nickname: 'Fatou',
      profilePicture: '',
    },
    content: 'je prends',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventBus },
        { provide: getModelToken(Comment.name), useValue: mockCommentModel },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: getModelToken(LiveSession.name), useValue: mockLiveModel },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);

    mockLiveModel.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSession),
      }),
    });
    mockCommentModel.create.mockResolvedValue({ ...mockComment });
    mockOrderModel.create.mockResolvedValue(mockOrder);
    mockLiveModel.updateOne.mockResolvedValue({});
  });

  describe('handleComment — pré-filtrage sans IA', () => {
    it('marque noise si pas de produit en vedette', async () => {
      const sessionWithoutProduct = { ...mockSession, currentProductId: null };
      mockLiveModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sessionWithoutProduct),
        }),
      });

      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      await service.handleComment(baseEvent);

      expect(comment.matchStatus).toBe('noise');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('marque noise pour un commentaire uniquement emoji', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      await service.handleComment({ ...baseEvent, content: '❤️❤️❤️' });

      expect(comment.matchStatus).toBe('noise');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('marque noise pour un commentaire trop court', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      await service.handleComment({ ...baseEvent, content: 'x' });

      expect(comment.matchStatus).toBe('noise');
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('ignore le commentaire si la session est introuvable', async () => {
      mockLiveModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await service.handleComment(baseEvent);

      expect(mockCommentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('handleComment — happy path IA', () => {
    it('crée un Order pour "je prends" avec confidence > 0.8', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'order_intent',
                quantity: 1,
                variants: {},
                buyerPhone: null,
                confidence: 0.9,
                reasoning: 'Expression explicite',
              }),
            },
          },
        ],
      });

      await service.handleComment({ ...baseEvent, content: 'je prends' });

      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: 'default-seller',
          buyerTiktokUsername: 'acheteur_dakar',
          status: 'captured',
          matchConfidence: 0.9,
          needsManualReview: false,
        }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'order.captured',
        expect.objectContaining({ sellerId: 'default-seller', confidence: 0.9 }),
      );
    });

    it('extrait la variante taille M correctement', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'order_intent',
                quantity: 1,
                variants: { taille: 'M' },
                buyerPhone: null,
                confidence: 0.95,
                reasoning: 'coumb + variante explicite',
              }),
            },
          },
        ],
      });

      await service.handleComment({ ...baseEvent, content: 'coumb taille M' });

      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              variant: new Map([['taille', 'M']]),
            }),
          ]),
        }),
      );
    });

    it('marque question pour "sa prix?" sans créer de commande', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'question',
                quantity: 1,
                variants: {},
                buyerPhone: null,
                confidence: 0.95,
                reasoning: 'Question sur le prix',
              }),
            },
          },
        ],
      });

      await service.handleComment({ ...baseEvent, content: 'sa prix?' });

      expect(comment.matchStatus).toBe('question');
      expect(mockOrderModel.create).not.toHaveBeenCalled();
    });

    it('needsManualReview=true si confidence < 0.7', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'order_intent',
                quantity: 1,
                variants: {},
                buyerPhone: null,
                confidence: 0.6,
                reasoning: 'Ambigu',
              }),
            },
          },
        ],
      });

      await service.handleComment({ ...baseEvent, content: 'moi 1' });

      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ needsManualReview: true }),
      );
    });

    it('invalide les variantes hors catalogue du produit', async () => {
      const comment = { ...mockComment };
      mockCommentModel.create.mockResolvedValue(comment);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'order_intent',
                quantity: 1,
                variants: { taille: 'XL' },
                buyerPhone: null,
                confidence: 0.85,
                reasoning: 'Variante hors catalogue',
              }),
            },
          },
        ],
      });

      await service.handleComment({ ...baseEvent, content: 'je prends XL' });

      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              variant: new Map(),
            }),
          ]),
          needsManualReview: true,
        }),
      );
    });
  });
});
