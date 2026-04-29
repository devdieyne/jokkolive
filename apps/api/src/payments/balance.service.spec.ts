import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BalanceService } from './balance.service';
import {
  SellerBalance,
  SellerBalanceDocument,
} from './schemas/seller-balance.schema';
import {
  BalanceTransaction,
  BalanceTransactionDocument,
} from './schemas/balance-transaction.schema';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { PaymentLink } from '../schemas/payment-link.schema';
import { Order } from '../schemas/order.schema';
import { User } from '../schemas/user.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { TransactionDetails } from './providers/payment-provider.interface';

/**
 * Tests : on remplace les Mongoose models par de simples mocks in-memory.
 * Le but est de vérifier la consistance des snapshots `availableAfter` /
 * `pendingAfter` après chaque mutation.
 */

interface FakeBalance {
  _id: string;
  sellerId: Types.ObjectId;
  provider: 'WAVE' | 'ORANGE_MONEY';
  currency: 'XOF';
  available: number;
  pending: number;
  save: () => Promise<FakeBalance>;
}

interface FakeTx {
  _id: string;
  sellerId: Types.ObjectId;
  provider: 'WAVE' | 'ORANGE_MONEY';
  type: 'credit' | 'debit' | 'reverse';
  amount: number;
  availableAfter: number;
  pendingAfter: number;
  description: string;
}

function makeBalance(sellerId: Types.ObjectId): FakeBalance {
  const b: FakeBalance = {
    _id: new Types.ObjectId().toString(),
    sellerId,
    provider: 'WAVE',
    currency: 'XOF',
    available: 0,
    pending: 0,
    save: async () => b,
  };
  return b;
}

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceStore: FakeBalance[];
  let txStore: FakeTx[];
  let paymentLinkSaveCalls: number;
  let orderUpdates: Array<{ id: unknown; update: unknown }>;

  beforeEach(async () => {
    balanceStore = [];
    txStore = [];
    paymentLinkSaveCalls = 0;
    orderUpdates = [];

    const balanceModel = {
      findOne: jest.fn((q: { sellerId: Types.ObjectId; provider: string }) => ({
        exec: async () =>
          balanceStore.find(
            (b) =>
              b.sellerId.toString() === q.sellerId.toString() &&
              b.provider === q.provider,
          ) ?? null,
      })),
      create: jest.fn(async (data: Partial<FakeBalance>) => {
        const b = makeBalance(data.sellerId as Types.ObjectId);
        b.provider = (data.provider ?? 'WAVE') as 'WAVE' | 'ORANGE_MONEY';
        balanceStore.push(b);
        return b;
      }),
    };

    const txModel = {
      find: jest.fn(() => ({
        sort: () => ({ limit: () => ({ exec: async () => txStore }) }),
      })),
      create: jest.fn(async (data: Partial<FakeTx>) => {
        const tx: FakeTx = {
          _id: new Types.ObjectId().toString(),
          sellerId: data.sellerId as Types.ObjectId,
          provider: data.provider as 'WAVE' | 'ORANGE_MONEY',
          type: data.type as 'credit' | 'debit' | 'reverse',
          amount: data.amount ?? 0,
          availableAfter: data.availableAfter ?? 0,
          pendingAfter: data.pendingAfter ?? 0,
          description: data.description ?? '',
        };
        txStore.push(tx);
        return tx;
      }),
    };

    const paymentLinkModel = {};

    const orderModel = {
      findByIdAndUpdate: jest.fn((id: unknown, update: unknown) => ({
        exec: async () => {
          orderUpdates.push({ id, update });
          return null;
        },
      })),
    };

    const userModel = {
      findById: jest.fn(() => ({ exec: async () => null })),
    };

    const whatsappMock = {
      sendText: jest.fn(async () => undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getModelToken(SellerBalance.name), useValue: balanceModel },
        {
          provide: getModelToken(BalanceTransaction.name),
          useValue: txModel,
        },
        {
          provide: getModelToken(PaymentLink.name),
          useValue: paymentLinkModel,
        },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: WhatsappService, useValue: whatsappMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): unknown => {
              if (key === 'PLATFORM_FEE_FLAT') return 50;
              if (key === 'PLATFORM_FEE_PERCENT') return 0.02;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(BalanceService);
  });

  it('computes fee = 50 + 2% rounded', () => {
    expect(service.computeFee(1000)).toEqual({ fee: 70, net: 930 });
    expect(service.computeFee(10_000)).toEqual({ fee: 250, net: 9750 });
    expect(service.computeFee(40)).toEqual({ fee: 51, net: 0 }); // edge: net 0
  });

  it('credits seller balance after payment, marks link paid, snapshots correct', async () => {
    const sellerId = new Types.ObjectId();
    const orderId = new Types.ObjectId();
    const link = {
      _id: new Types.ObjectId(),
      token: 'abc',
      sellerId,
      orderId,
      amount: 10_000,
      status: 'pending' as 'pending' | 'paid' | 'expired' | 'cancelled',
      paymentMethodUsed: 'WAVE' as 'WAVE' | 'ORANGE_MONEY' | undefined,
      psp: undefined as 'diamanopay' | undefined,
      paidAt: undefined as Date | undefined,
      platformFee: undefined as number | undefined,
      sellerNet: undefined as number | undefined,
      externalRef: undefined as string | undefined,
      save: jest.fn(async function (this: unknown) {
        paymentLinkSaveCalls++;
        return this;
      }),
    } as unknown as Parameters<BalanceService['creditFromPayment']>[0];

    const tx: TransactionDetails = {
      id: 'TX-1',
      amount: -10_000,
      status: 'SUCCESS',
      paymentMethod: 'WAVE',
      transactionType: 'PAY_IN',
    };

    await service.creditFromPayment(link, tx);

    // Link mutated and saved
    expect(paymentLinkSaveCalls).toBe(1);
    expect(
      (link as unknown as { status: string }).status,
    ).toBe('paid');
    expect(
      (link as unknown as { sellerNet: number }).sellerNet,
    ).toBe(9750);
    expect(
      (link as unknown as { platformFee: number }).platformFee,
    ).toBe(250);

    // Order updated
    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0].id).toBe(orderId);

    // Balance incremented
    expect(balanceStore).toHaveLength(1);
    expect(balanceStore[0].available).toBe(9750);
    expect(balanceStore[0].pending).toBe(0);

    // Ledger entry written with correct snapshots
    expect(txStore).toHaveLength(1);
    expect(txStore[0]).toMatchObject({
      type: 'credit',
      amount: 9750,
      availableAfter: 9750,
      pendingAfter: 0,
      provider: 'WAVE',
    });
  });

  it('debitForPayout moves available → pending and snapshots after', async () => {
    const sellerId = new Types.ObjectId();
    // Pre-seed a balance with funds
    const b = makeBalance(sellerId);
    b.available = 5000;
    b.provider = 'ORANGE_MONEY';
    balanceStore.push(b);

    const payout = {
      _id: new Types.ObjectId(),
      sellerId,
      provider: 'ORANGE_MONEY' as const,
      amount: 2000,
    } as unknown as PayoutDocument;

    await service.debitForPayout(payout);

    expect(b.available).toBe(3000);
    expect(b.pending).toBe(2000);
    expect(txStore).toHaveLength(1);
    expect(txStore[0]).toMatchObject({
      type: 'debit',
      amount: 2000,
      availableAfter: 3000,
      pendingAfter: 2000,
    });
  });

  it('reversePayout returns pending → available and writes a reverse entry', async () => {
    const sellerId = new Types.ObjectId();
    const b = makeBalance(sellerId);
    b.available = 0;
    b.pending = 2000;
    b.provider = 'WAVE';
    balanceStore.push(b);

    const payout = {
      _id: new Types.ObjectId(),
      sellerId,
      provider: 'WAVE' as const,
      amount: 2000,
    } as unknown as PayoutDocument;

    await service.reversePayout(payout, 'PSP refused');

    expect(b.available).toBe(2000);
    expect(b.pending).toBe(0);
    expect(txStore).toHaveLength(1);
    expect(txStore[0]).toMatchObject({
      type: 'reverse',
      amount: 2000,
      availableAfter: 2000,
      pendingAfter: 0,
    });
    expect(txStore[0].description).toContain('PSP refused');
  });

  it('confirmPayout consumes pending, available unchanged', async () => {
    const sellerId = new Types.ObjectId();
    const b = makeBalance(sellerId);
    b.available = 3000;
    b.pending = 2000;
    b.provider = 'WAVE';
    balanceStore.push(b);

    const payout = {
      _id: new Types.ObjectId(),
      sellerId,
      provider: 'WAVE' as const,
      amount: 2000,
    } as unknown as PayoutDocument;

    await service.confirmPayout(payout);

    expect(b.available).toBe(3000);
    expect(b.pending).toBe(0);
    expect(txStore).toHaveLength(1);
    expect(txStore[0]).toMatchObject({
      type: 'debit',
      amount: 2000,
      availableAfter: 3000,
      pendingAfter: 0,
    });
  });

  it('debit then reverse round-trip leaves available unchanged', async () => {
    const sellerId = new Types.ObjectId();
    const b = makeBalance(sellerId);
    b.available = 5000;
    b.provider = 'WAVE';
    balanceStore.push(b);

    const payout = {
      _id: new Types.ObjectId(),
      sellerId,
      provider: 'WAVE' as const,
      amount: 1500,
    } as unknown as PayoutDocument;

    await service.debitForPayout(payout);
    await service.reversePayout(payout, 'timeout');

    expect(b.available).toBe(5000);
    expect(b.pending).toBe(0);
    expect(txStore).toHaveLength(2);
    expect(txStore[1].availableAfter).toBe(5000);
    expect(txStore[1].pendingAfter).toBe(0);
  });
});

// Suppress unused-var warnings for declared but-not-asserted helpers
void Payout;
void SellerBalance;
void BalanceTransaction;
void (null as unknown as SellerBalanceDocument);
void (null as unknown as BalanceTransactionDocument);
