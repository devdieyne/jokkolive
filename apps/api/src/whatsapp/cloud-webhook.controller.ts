import {
  Body,
  Controller,
  ForbiddenException,
  forwardRef,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Payload Meta Cloud API (simplifié — on ne consomme que ce qu'on utilise).
 * Doc complète : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
interface CloudWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: Array<{
          id?: string;
          from?: string; // wa_id du buyer
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: unknown[]; // delivery / read receipts (ignorés)
      };
    }>;
  }>;
}

/** Même regex que côté WAHA — format de commande commun. */
const COMMAND_RE =
  /^\s*@?([a-z0-9_]{3,20})\s*[: ]\s*([A-Z]{1,4}\d{1,5})(?:\s+(\+?\d{8,15}))?\s*$/i;

/**
 * Webhook Meta WhatsApp Business Cloud API.
 *
 * Deux endpoints sur la même route :
 *  - `GET  /webhooks/whatsapp/cloud` : challenge de vérification (one-shot
 *    quand on configure le webhook dans Meta App Dashboard)
 *  - `POST /webhooks/whatsapp/cloud` : événements (messages entrants, statuts)
 *
 * Sécurité : signature HMAC-SHA256 vérifiée via `X-Hub-Signature-256` avec
 * l'**App Secret** Meta (pas le token, c'est différent).
 */
@Controller('webhooks/whatsapp/cloud')
export class CloudWebhookController {
  private readonly logger = new Logger(CloudWebhookController.name);

  private readonly verifyToken: string;
  private readonly appSecret: string;

  /** Dédup `msg.id` (Meta peut retry) */
  private readonly processedIds = new Map<string, number>();
  private readonly DEDUP_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {
    this.verifyToken =
      this.configService.get<string>('WHATSAPP_CLOUD_VERIFY_TOKEN') ?? '';
    this.appSecret =
      this.configService.get<string>('WHATSAPP_CLOUD_APP_SECRET') ?? '';
  }

  /**
   * Challenge handshake. Meta appelle cet endpoint **une fois** quand tu
   * configures l'URL du webhook dans le dashboard. Tu dois renvoyer
   * `hub.challenge` en plain text si `hub.verify_token` correspond.
   */
  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    if (mode === 'subscribe' && token && token === this.verifyToken) {
      this.logger.log('✅ Webhook Cloud vérifié par Meta');
      return challenge ?? '';
    }
    this.logger.warn('❌ Vérification webhook Cloud échouée');
    throw new ForbiddenException('Verification failed');
  }

  @Post()
  @HttpCode(200)
  async onEvent(
    @Body() body: CloudWebhookPayload,
    @Headers('x-hub-signature-256') signatureHeader?: string,
    @Req() req?: Request & { rawBody?: Buffer },
  ) {
    // Vérification HMAC. Indispensable en prod : sans ça, n'importe qui peut
    // pousser des faux événements et créer des fausses commandes.
    if (this.appSecret) {
      const raw = req?.rawBody;
      if (!raw) {
        this.logger.error(
          'rawBody manquant — vérifier `app.use(json({ verify }))` dans main.ts',
        );
        throw new ForbiddenException('Missing raw body');
      }
      if (!this.verifySignature(raw, signatureHeader)) {
        this.logger.warn('🔒 Webhook Cloud refusé : signature invalide');
        throw new ForbiddenException('Invalid signature');
      }
    }

    // Meta envoie un payload structuré : on aplatit pour itérer simplement.
    const messages: Array<{
      id?: string;
      from?: string;
      text?: string;
      name?: string;
    }> = [];

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const m of value.messages) {
          if (m.type !== 'text' || !m.text?.body || !m.from) continue;
          messages.push({
            id: m.id,
            from: m.from,
            text: m.text.body,
            name: contactName,
          });
        }
      }
    }

    for (const msg of messages) {
      if (msg.id) {
        this.gcDedup();
        if (this.processedIds.has(msg.id)) continue;
        this.processedIds.set(msg.id, Date.now());
      }

      const text = msg.text!.trim();
      const match = COMMAND_RE.exec(text);
      if (!match) {
        this.logger.debug(`Cloud msg ignoré (format) de ${msg.from}: "${text}"`);
        continue;
      }

      const [, pseudo, code, explicitPhone] = match;

      // Cloud API : pas de lid, le `from` est déjà un E.164 sans `+`.
      // L'éventuel `explicitPhone` reste prioritaire (cas rare où le buyer
      // commande pour un proche).
      const buyerPhone = explicitPhone
        ? '+' + explicitPhone.replace(/[^0-9]/g, '')
        : '+' + msg.from!.replace(/[^0-9]/g, '');
      const buyerChatId = msg.from!; // wa_id digits-only — on le garde pour reply

      this.logger.log(
        `📩 Cloud cmd de ${buyerPhone} : @${pseudo}:${code}`,
      );

      try {
        await this.ordersService.handleIncomingMessage({
          buyerPhone,
          buyerChatId,
          buyerName: msg.name,
          pseudo: pseudo.toLowerCase(),
          code: code.toUpperCase(),
          rawMessage: text,
        });
      } catch (err) {
        // Ne jamais throw : Meta retry-erait toutes les 5 minutes pendant 7j.
        this.logger.error(
          `Erreur traitement Cloud msg ${msg.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { ok: true };
  }

  private verifySignature(raw: Buffer, header?: string): boolean {
    if (!header || !header.startsWith('sha256=')) return false;
    const expected = header.slice('sha256='.length);
    const computed = createHmac('sha256', this.appSecret)
      .update(raw)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(computed, 'hex');
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private gcDedup(): void {
    const cutoff = Date.now() - this.DEDUP_TTL_MS;
    for (const [id, ts] of this.processedIds) {
      if (ts < cutoff) this.processedIds.delete(id);
    }
  }
}
