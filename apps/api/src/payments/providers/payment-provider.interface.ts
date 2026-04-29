/**
 * Abstraction PSP — toute intégration future (Stripe, etc.) doit
 * implémenter cette interface. La sélection se fait via `ACTIVE_PSP` env.
 */

export type ChargeProvider = 'WAVE' | 'ORANGE_MONEY';

export interface CreateChargeInput {
  amount: number;
  currency: 'XOF';
  provider: ChargeProvider;
  description: string;
  clientReference: string;
  redirectUrl: string;
  webhookUrl: string;
  extraData?: Record<string, unknown>;
}

export interface CreateChargeResult {
  paymentUrl: string;
  qrCodeData?: string;
  pspChargeId: string;
  expiresAt?: Date;
}

export interface CreatePayoutInput {
  amount: number;
  /** Numéro local (9 chiffres au Sénégal), sans indicatif. */
  mobile: string;
  provider: ChargeProvider;
  recipientName?: string;
  description: string;
  /** Idempotency key généré par nous. */
  clientReference: string;
}

export interface CreatePayoutResult {
  pspTransactionId: string;
  pspProviderTransactionId?: string;
}

export interface TransactionDetails {
  id: string;
  /** Montant signé tel que renvoyé par le PSP (négatif pour les payouts). */
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | string;
  paymentMethod: ChargeProvider;
  transactionType: 'PAY_IN' | 'PAY_OUT';
  clientReference?: string;
  fee?: number;
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
  getTransaction(transactionId: string): Promise<TransactionDetails>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
