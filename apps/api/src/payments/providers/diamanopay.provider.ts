import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreateChargeInput,
  CreateChargeResult,
  CreatePayoutInput,
  CreatePayoutResult,
  PaymentProvider,
  TransactionDetails,
  ChargeProvider,
} from './payment-provider.interface';

/**
 * Erreur spécifique aux appels DiamanoPay — porte le message upstream
 * (utile pour exposer une cause utilisateur lisible).
 */
export class DiamanoPayError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamBody?: unknown,
  ) {
    super(message);
    this.name = 'DiamanoPayError';
  }
}

interface ChargeApiResponse {
  chargeId?: string;
  id?: string;
  paymentUrl?: string;
  qrCodeData?: string;
  qrCode?: string;
  expiresAt?: string;
}

interface PayoutApiResponse {
  success?: boolean;
  message?: string;
  transactionId?: string;
  providerTransactionId?: string;
}

interface TransactionApiResponse {
  id?: string;
  transactionId?: string;
  amount?: number;
  status?: string;
  paymentMethod?: string;
  provider?: string;
  transactionType?: string;
  clientReference?: string;
  fee?: number;
}

/**
 * Client HTTP DiamanoPay. Utilise `fetch` global (cohérent avec
 * `whatsapp.service.ts`) — pas de @nestjs/axios dans ce projet.
 *
 * Mock mode : si `DIAMANO_PAY_TOKEN` est vide, toute opération lève
 * `ServiceUnavailableException`. Pas de fake success — le dev DOIT
 * voir l'erreur pour configurer ses creds.
 */
@Injectable()
export class DiamanoPayProvider implements PaymentProvider {
  readonly name = 'diamanopay';
  private readonly logger = new Logger(DiamanoPayProvider.name);

  private readonly token: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('DIAMANO_PAY_TOKEN') ?? '';
    this.baseUrl =
      this.configService.get<string>('DIAMANO_PAY_BASE_URL') ??
      'https://api.diamanopay.com';
    if (!this.token) {
      this.logger.warn(
        'DiamanoPay non configuré (DIAMANO_PAY_TOKEN manquant) — toutes les opérations PSP échoueront.',
      );
    }
  }

  private ensureConfigured(): void {
    if (!this.token) {
      throw new ServiceUnavailableException('PSP non configuré');
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    this.ensureConfigured();
    const url = `${this.baseUrl}${path}`;
    const sanitized = body
      ? JSON.stringify(body).replace(/("?token"?\s*:\s*")[^"]+(")/gi, '$1***$2')
      : undefined;
    this.logger.debug(`→ ${method} ${path}${sanitized ? ` ${sanitized}` : ''}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`DiamanoPay réseau injoignable: ${msg}`);
      throw new BadGatewayException('PSP injoignable');
    }

    const rawText = await res.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText) as unknown;
      } catch {
        parsed = rawText;
      }
    }

    if (!res.ok) {
      this.logger.error(
        `DiamanoPay ${method} ${path} → ${res.status} ${rawText}`,
      );
      const message =
        (typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message?: unknown }).message ?? '')
          : '') || `DiamanoPay HTTP ${res.status}`;
      throw new DiamanoPayError(message, res.status, parsed);
    }

    return parsed as T;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const payload = {
      amount: input.amount,
      provider: input.provider,
      description: input.description,
      clientReference: input.clientReference,
      redirectUrl: input.redirectUrl,
      webhook: input.webhookUrl,
      extraData: input.extraData ?? {},
    };
    const res = await this.request<ChargeApiResponse>(
      'POST',
      '/api/charges',
      payload,
    );

    const chargeId = res.chargeId ?? res.id;
    const paymentUrl = res.paymentUrl;
    if (!chargeId || !paymentUrl) {
      this.logger.error(
        `DiamanoPay charge: réponse incomplète ${JSON.stringify(res)}`,
      );
      throw new DiamanoPayError(
        'Réponse DiamanoPay incomplète (chargeId/paymentUrl manquant)',
      );
    }
    return {
      pspChargeId: chargeId,
      paymentUrl,
      qrCodeData: res.qrCodeData ?? res.qrCode,
      expiresAt: res.expiresAt ? new Date(res.expiresAt) : undefined,
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const payload = {
      amount: input.amount,
      mobile: input.mobile,
      provider: input.provider,
      name: input.recipientName,
      description: input.description,
      clientReference: input.clientReference,
    };
    const res = await this.request<PayoutApiResponse>(
      'POST',
      '/api/payout',
      payload,
    );
    if (res.success !== true) {
      const msg = res.message || 'Échec du payout DiamanoPay';
      this.logger.error(`DiamanoPay payout: ${msg}`);
      throw new DiamanoPayError(msg, undefined, res);
    }
    if (!res.transactionId) {
      throw new DiamanoPayError('Réponse payout sans transactionId');
    }
    return {
      pspTransactionId: res.transactionId,
      pspProviderTransactionId: res.providerTransactionId,
    };
  }

  async getTransaction(transactionId: string): Promise<TransactionDetails> {
    // ⚠️ DiamanoPay ne renvoie PAS de champ `status` dans GET /api/transaction.
    // Convention : si la requête répond 200 avec un `id`, la transaction
    // existe et est confirmée — on retourne 'SUCCESS'. Les erreurs 4xx/5xx
    // sont déjà transformées en DiamanoPayError par `request()`.
    //
    // Le `amount` peut être négatif pour les PAY_OUT — on garde le signe
    // tel quel ; le contrôleur webhook compare avec `Math.abs()`.
    const res = await this.request<TransactionApiResponse>(
      'GET',
      `/api/transaction/${encodeURIComponent(transactionId)}`,
    );
    if (!res || (!res.id && !res.transactionId)) {
      throw new DiamanoPayError('Transaction introuvable côté PSP');
    }
    const id = res.id ?? res.transactionId ?? transactionId;
    const method = (res.paymentMethod ?? res.provider ?? '') as string;
    const txType = (res.transactionType ?? '').toUpperCase();
    return {
      id,
      amount: typeof res.amount === 'number' ? res.amount : 0,
      status: 'SUCCESS',
      paymentMethod: (method.toUpperCase() === 'ORANGE_MONEY'
        ? 'ORANGE_MONEY'
        : 'WAVE') as ChargeProvider,
      transactionType: txType === 'PAY_OUT' ? 'PAY_OUT' : 'PAY_IN',
      clientReference: res.clientReference,
      fee: res.fee,
    };
  }
}
