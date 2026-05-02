import {
  Body,
  Controller,
  forwardRef,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { WhatsappService } from './whatsapp.service';
import { OrdersService } from '../orders/orders.service';

interface WahaWebhookPayload {
  event?: string;
  session?: string;
  payload?: {
    id?: string;
    from?: string;
    fromMe?: boolean;
    body?: string;
    timestamp?: number;
    _data?: { notifyName?: string };
  };
}

/**
 * Format accepté (tous équivalents) :
 *   @pseudo:CODE
 *   @pseudo CODE                       → espace à la place de `:`
 *   @pseudo: CODE                      → `:` puis espace
 *   pseudo:CODE                        → `@` optionnel
 *   pseudo CODE                        → ni `@` ni `:`
 *   <n'importe quel format> +352621585043   → numéro explicite (utile si le
 *                                              compte expose un `@lid` non
 *                                              livrable)
 *
 * Volontairement permissif pour absorber les typos en live TikTok :
 *  - `@` optionnel
 *  - séparateurs acceptés : `:`, ` `, `.`, `-`, `,`
 *  - code avec ou sans préfixe lettre (`R1`, `J5`, `12`, `45`)
 *  - téléphone explicite optionnel en fin
 *
 * Exemples qui matchent :
 *   `@abou:R1`   `abou:R1`   `Abou R1`   `abou.R1`   `abou-r1`   `abou 45`
 */
const COMMAND_RE =
  /^\s*@?([a-z0-9_]{3,20})\s*[:.\- ,]+\s*([A-Z]{0,4}\d{1,5})(?:\s+(\+?\d{8,15}))?\s*$/i;

@Controller('webhooks/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly expectedToken: string;

  /** Dédup des `msg.id` traités sur les 10 dernières minutes (anti-retry WAHA). */
  private readonly processedIds = new Map<string, number>();
  private readonly DEDUP_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {
    this.expectedToken =
      this.configService.get<string>('WAHA_WEBHOOK_TOKEN') ?? '';
  }

  @Post('message')
  @HttpCode(200)
  async onMessage(
    @Body() body: WahaWebhookPayload,
    @Query('token') token?: string,
  ) {
    if (this.expectedToken) {
      const provided = token ?? '';
      const a = Buffer.from(this.expectedToken);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        this.logger.warn('Webhook WhatsApp refusé : token invalide');
        throw new UnauthorizedException('Token invalide');
      }
    }

    const msg = body.payload;
    if (!msg || msg.fromMe || !msg.body || !msg.from) {
      return { ignored: true };
    }

    // Dédup par msg.id : WAHA peut retry, ou on peut écouter plusieurs events
    // qui couvrent le même message. On ne traite qu'une seule fois.
    if (msg.id) {
      this.gcDedup();
      if (this.processedIds.has(msg.id)) {
        return { ignored: true, reason: 'duplicate' };
      }
      this.processedIds.set(msg.id, Date.now());
    }


    const text = msg.body.trim();
    const match = COMMAND_RE.exec(text);

    if (!match) {
      this.logger.debug(`Message ignoré (format) de ${msg.from} : "${text}"`);
      return { ignored: true, reason: 'unrecognized-format' };
    }

    const [, pseudo, code, explicitPhone] = match;

    // Priorité de résolution du numéro :
    //   1. Numéro explicitement fourni dans le message (le plus fiable)
    //   2. Résolution via WAHA contacts (marche pour @c.us, pas toujours pour @lid)
    //   3. Sinon : on garde le @lid comme identifiant et on essaie d'y répondre
    let buyerPhone: string;
    let buyerChatId: string;
    let phoneSource: 'explicit' | 'resolved' | 'lid';

    if (explicitPhone) {
      const normalized = '+' + explicitPhone.replace(/[^0-9]/g, '');
      buyerPhone = normalized;
      buyerChatId = `${normalized.replace(/[^0-9]/g, '')}@c.us`;
      phoneSource = 'explicit';
    } else {
      const resolved = await this.whatsappService.resolvePhoneFromChatId(
        msg.from,
      );
      if (resolved) {
        buyerPhone = resolved;
        buyerChatId = `${resolved.replace(/[^0-9]/g, '')}@c.us`;
        phoneSource = 'resolved';
      } else {
        // Lid non résoluble : DB stocke `lid:xxx` pour ne pas confondre
        // avec un E.164. Le reply est tenté sur le lid (peut échouer).
        buyerPhone = `lid:${msg.from.split('@')[0]}`;
        buyerChatId = msg.from;
        phoneSource = 'lid';
      }
    }

    this.logger.log(
      `📩 Commande WhatsApp de ${buyerPhone} (${phoneSource}) : @${pseudo}:${code}`,
    );

    // Si on n'a que le lid : on prévient l'acheteur qu'il doit fournir son
    // numéro pour recevoir le lien. Le message tente d'arriver sur le lid ;
    // si WhatsApp filtre, le vendeur verra la commande dans le dashboard.
    if (phoneSource === 'lid') {
      await this.whatsappService.sendText(
        buyerChatId,
        `⚠️ On ne peut pas récupérer ton numéro automatiquement. Renvoie ta commande au format :\n\n@${pseudo}:${code} +33XXXXXXXXX\n\n(remplace par ton numéro avec l'indicatif pays)`,
      );
      return { ok: true, needsPhone: true };
    }

    await this.ordersService.handleIncomingMessage({
      buyerPhone,
      buyerChatId,
      buyerName: msg._data?.notifyName,
      pseudo: pseudo.toLowerCase(),
      code: code.toUpperCase(),
      rawMessage: text,
    });

    return { ok: true };
  }

  private gcDedup(): void {
    const cutoff = Date.now() - this.DEDUP_TTL_MS;
    for (const [id, ts] of this.processedIds) {
      if (ts < cutoff) this.processedIds.delete(id);
    }
  }
}
