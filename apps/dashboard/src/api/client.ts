import type {
  AppUser,
  AuthResponse,
  BalanceTransaction,
  CheckoutResult,
  Currency,
  Order,
  OrderStatus,
  Payout,
  PayoutProvider,
  Product,
  PublicPaymentLink,
  SellerBalance,
  UserRecord,
} from '../types';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (!window.location.pathname.startsWith('/pay/')) {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (json.message) {
        message = Array.isArray(json.message) ? json.message.join(', ') : json.message;
      }
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth (OTP via WhatsApp) ───────────────────────────────────────────────────
// Note : l'inscription publique est désactivée — un compte ne peut être créé
// que par un admin via createUser() (POST /users). Pas d'API register() ici.

export interface OtpFallback {
  whatsappNumber: string;
  link: string;
  prefilledMessage: string;
}

export const requestOtp = (phone: string) =>
  req<{ sent: boolean; fallback?: OtpFallback }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });

export const verifyOtp = (phone: string, code: string) =>
  req<AuthResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });

// ── Auth (Magic Link via WhatsApp user-initiated) ────────────────────────────
// Inscription publique désactivée → le magic link sert UNIQUEMENT à se
// connecter à un compte existant. Si le user envoie "LOGIN" sur WhatsApp
// sans compte, le webhook répond "contactez l'admin" et n'émet pas de lien.

export const verifyMagicLink = (token: string) =>
  req<AuthResponse>('/auth/magic/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const getMe = () => req<AuthResponse>('/auth/me');

export const updateCurrency = (currency: Currency) =>
  req<AuthResponse>('/auth/me/currency', {
    method: 'PATCH',
    body: JSON.stringify({ currency }),
  });

// ── Users (admin) ─────────────────────────────────────────────────────────────

export const getUsers = () => req<UserRecord[]>('/users');

export const createUser = (data: {
  phone: string;
  pseudo: string;
  displayName: string;
  role?: 'admin' | 'seller';
  currency?: Currency;
}) => req<UserRecord>('/users', { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (
  id: string,
  data: Partial<{
    displayName: string;
    role: 'admin' | 'seller';
    currency: Currency;
    disabled: boolean;
  }>,
) =>
  req<UserRecord>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteUser = (id: string) =>
  req<void>(`/users/${id}`, { method: 'DELETE' });

/** Admin : override des frais plateforme pour un vendeur. */
export const setUserPlatformFee = (
  id: string,
  data: { flat: number; percent: number },
) =>
  req<UserRecord>(`/users/${id}/platform-fee`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

/** Admin : reset → retour aux frais env globaux. */
export const clearUserPlatformFee = (id: string) =>
  req<UserRecord>(`/users/${id}/platform-fee`, { method: 'DELETE' });

// ── Admin stats ──────────────────────────────────────────────────────────────

export interface RevenueBucket {
  totalFee: number;
  totalGross: number;
  count: number;
}

export interface AdminRevenue {
  allTime: RevenueBucket;
  last30d: RevenueBucket;
  last7d: RevenueBucket;
  today: RevenueBucket;
  topSellers: Array<{
    sellerId: string;
    pseudo: string;
    displayName: string;
    totalFee: number;
    count: number;
  }>;
}

export const getAdminRevenue = () =>
  req<AdminRevenue>('/admin/stats/revenue');

// ── Products ─────────────────────────────────────────────────────────────────

export const getMyProducts = () => req<Product[]>('/products');

export const createProduct = (data: {
  name: string;
  prefix: string;
  price: number;
  stock?: number;
  description?: string;
  imageUrl?: string;
}) => req<Product>('/products', { method: 'POST', body: JSON.stringify(data) });

export const updateProduct = (
  id: string,
  data: Partial<{
    name: string;
    price: number;
    stock: number;
    description: string;
    imageUrl: string;
    disabled: boolean;
  }>,
) =>
  req<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteProduct = (id: string) =>
  req<void>(`/products/${id}`, { method: 'DELETE' });

// ── Orders ────────────────────────────────────────────────────────────────────

export const getMyOrders = () => req<Order[]>('/orders');

export const updateOrder = (
  id: string,
  data: { status?: OrderStatus; buyerName?: string },
) =>
  req<Order>(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

// ── Payments ─────────────────────────────────────────────────────────────────

/** Public — pas d'auth — pour la page de paiement de l'acheteur. */
export const getPublicPaymentLink = (token: string) =>
  req<PublicPaymentLink>(`/pay/${token}`);

/** Vendeur connecté marque manuellement un paiement reçu. */
export const markPaymentPaid = (token: string, externalRef?: string) =>
  req<void>(`/payments/${token}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify(externalRef ? { externalRef } : {}),
  });

/** Acheteur choisit Wave / Orange Money → on récupère le paymentUrl PSP. */
export const initiateCheckout = (token: string, provider: PayoutProvider) =>
  req<CheckoutResult>(`/pay/${token}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });

// ── Wallet vendeur ───────────────────────────────────────────────────────────

export const getMyBalances = () => req<SellerBalance[]>('/me/balances');

export const getBalanceTransactions = (
  provider: PayoutProvider,
  limit = 50,
) =>
  req<BalanceTransaction[]>(
    `/me/balance/${provider}/transactions?limit=${limit}`,
  );

export const getMyPayouts = (limit = 50) =>
  req<Payout[]>(`/me/payouts?limit=${limit}`);

export const requestPayout = (amount: number, provider: PayoutProvider) =>
  req<Payout>('/me/payouts', {
    method: 'POST',
    body: JSON.stringify({ amount, provider }),
  });

export const updatePayoutAccounts = (data: {
  wave?: { mobile: string };
  orangeMoney?: { mobile: string };
}) =>
  req<{ payoutAccounts: AppUser['payoutAccounts'] }>('/me/payout-accounts', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const updateAutoPayout = (enabled: boolean) =>
  req<{ autoPayoutEnabled: boolean }>('/me/auto-payout', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });

// ── Catalogue public ─────────────────────────────────────────────────────────

export interface PublicShop {
  seller: { pseudo: string; displayName: string; currency: Currency };
  products: Product[];
  whatsappNumber: string | null;
}

export const getPublicShop = (pseudo: string) =>
  req<PublicShop>(`/public/shops/${encodeURIComponent(pseudo)}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

export type { AppUser };
