export type UserRole = 'admin' | 'seller';

export const SUPPORTED_CURRENCIES = [
  'XOF',
  'XAF',
  'EUR',
  'USD',
  'MAD',
  'GBP',
  'CAD',
  'NGN',
  'GHS',
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface AppUser {
  id: string;
  phone: string;
  pseudo: string;
  displayName: string;
  role: UserRole;
  currency: Currency;
  payoutAccounts?: {
    wave?: { mobile: string };
    orangeMoney?: { mobile: string };
  };
  share?: {
    whatsappNumber: string;
    prefilledMessage: string;
    link: string;
  };
}

export interface UserRecord {
  _id: string;
  phone: string;
  pseudo: string;
  displayName: string;
  role: UserRole;
  currency: Currency;
  disabled: boolean;
  createdAt: string;
}

export interface Product {
  _id: string;
  sellerId: string;
  name: string;
  prefix: string;
  seq: number;
  code: string;
  price: number;
  currency: Currency;
  stock: number;
  description?: string;
  imageUrl?: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface Order {
  _id: string;
  reference: string;
  sellerId: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: Currency;
  buyerPhone: string;
  buyerName?: string;
  rawMessage: string;
  status: OrderStatus;
  paymentLinkId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PayoutProvider = 'WAVE' | 'ORANGE_MONEY';

export interface PublicPaymentLink {
  token: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string;
  paymentMethodUsed?: PayoutProvider;
}

export interface SellerBalance {
  provider: PayoutProvider;
  available: number;
  pending: number;
  currency: 'XOF';
}

export interface BalanceTransaction {
  _id: string;
  sellerId: string;
  provider: PayoutProvider;
  type: 'credit' | 'debit' | 'reverse';
  amount: number;
  availableAfter: number;
  pendingAfter: number;
  description: string;
  createdAt: string;
  relatedOrderId?: string;
  relatedPayoutId?: string;
}

export interface Payout {
  _id: string;
  sellerId: string;
  provider: PayoutProvider;
  amount: number;
  currency: 'XOF';
  mobile: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
  pspTransactionId?: string;
}

export interface CheckoutResult {
  paymentUrl: string;
  qrCodeData?: string;
}

export interface AuthResponse {
  access_token: string;
  user: AppUser;
}
