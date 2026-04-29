import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Webhook DiamanoPay — adapté de dradia. On n'utilise PAS le `status` du
 * payload : on re-vérifie systématiquement la transaction via
 * `GET /api/transaction/{id}`. L'unique champ critique est `transactionId`.
 *
 * ⚠️ Le ValidationPipe global a `forbidNonWhitelisted: true`. Tous les
 * champs envoyés par DiamanoPay doivent donc être listés ici (même si on
 * ne les utilise pas), sinon la requête est rejetée en 400.
 *
 * Payload réel observé :
 *   {
 *     status, paymentService, transactionId, paymentRequestId, extraData
 *   }
 */
export class DiamanoPayWebhookDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  transactionId!: string;

  /** Méthode utilisée côté PSP — "WAVE" | "ORANGE_MONEY". Non utilisé : on récupère via getTransaction. */
  @IsOptional()
  @IsString()
  paymentService?: string;

  /** ID de la charge initiale (pas la transaction). Non utilisé. */
  @IsOptional()
  @IsString()
  paymentRequestId?: string;

  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>;
}
