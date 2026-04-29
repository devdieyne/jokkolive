import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendTextResponse {
  id?: string;
  error?: string;
}

interface WahaContact {
  id?: string;
  number?: string;
  pushname?: string;
  name?: string;
}

/**
 * Client WAHA — wrapper minimal sur l'API HTTP de WAHA.
 * Doc : https://waha.devlike.pro/docs/overview
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly session: string;
  private readonly enabled: boolean;

  /**
   * Cache lid → numéro E.164. WhatsApp Business affecte un Linked Device ID
   * (`xxx@lid`) à certains comptes au lieu du vrai numéro. On résout via
   * l'API contacts de WAHA, puis on garde en mémoire (le lid est stable
   * pour un même compte).
   */
  private readonly lidCache = new Map<string, string | null>();

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('WAHA_BASE_URL') ?? '';
    this.apiKey = this.configService.get<string>('WAHA_API_KEY') ?? '';
    this.session = this.configService.get<string>('WAHA_SESSION') ?? 'default';
    this.enabled = !!this.baseUrl;

    if (!this.enabled) {
      this.logger.warn(
        '⚠️  WAHA non configuré — les messages WhatsApp seront uniquement loggés.',
      );
    }
  }

  /**
   * Envoie un message texte. Accepte soit un numéro E.164 (`+221776583181`),
   * soit un chatId WhatsApp brut (`221776583181@c.us` ou `xxx@lid`).
   * Quand on répond à un webhook, on utilise le chatId reçu pour rester
   * dans le même fil — important pour les comptes WhatsApp Business / lid.
   */
  async sendText(recipient: string, text: string): Promise<void> {
    // Pour un `@lid`, on tente la résolution vers un `@c.us` car la livraison
    // est plus fiable. Si on n'arrive pas à résoudre, on envoie quand même
    // au lid — au moins le message a une chance d'arriver.
    let chatId: string;
    if (recipient.includes('@lid')) {
      const phone = await this.resolvePhoneFromChatId(recipient);
      chatId = phone ? this.toChatId(phone) : recipient;
    } else if (recipient.includes('@')) {
      chatId = recipient;
    } else {
      chatId = this.toChatId(recipient);
    }

    const displayId = chatId.includes('@lid')
      ? chatId
      : WhatsappService.chatIdToPhone(chatId) || chatId;

    if (!this.enabled) {
      this.logger.log(`[DRY-RUN WhatsApp] → ${displayId} : ${text}`);
      return;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          session: this.session,
          chatId,
          text,
        }),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        throw new Error(`WAHA ${res.status}: ${rawBody}`);
      }

      let data: SendTextResponse = {};
      if (rawBody) {
        try {
          data = JSON.parse(rawBody) as SendTextResponse;
        } catch {
          // WAHA peut renvoyer 200 sans body — pas une erreur en soi
        }
      }
      this.logger.debug(
        `✉️  WhatsApp envoyé à ${displayId} (id=${typeof data.id === 'string' ? data.id : '?'})`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec envoi WhatsApp à ${displayId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "Impossible d'envoyer le message WhatsApp pour le moment.",
      );
    }
  }

  /**
   * Résout un chatId entrant (webhook) en numéro E.164 stable.
   *
   * - `221776583181@c.us` → `+221776583181` (immédiat)
   * - `xxx@lid` → appelle WAHA `/api/contacts` pour obtenir le vrai numéro,
   *   met en cache, et fallback sur `null` si WhatsApp n'expose pas le numéro
   *   (compte business avec confidentialité).
   */
  async resolvePhoneFromChatId(chatId: string): Promise<string | null> {
    if (!chatId.includes('@lid')) {
      return WhatsappService.chatIdToPhone(chatId) || null;
    }

    if (this.lidCache.has(chatId)) {
      return this.lidCache.get(chatId) ?? null;
    }

    if (!this.enabled) {
      this.lidCache.set(chatId, null);
      return null;
    }

    try {
      const url = new URL(`${this.baseUrl}/api/contacts`);
      url.searchParams.set('session', this.session);
      url.searchParams.set('contactId', chatId);
      const res = await fetch(url.toString(), {
        headers: this.apiKey ? { 'X-Api-Key': this.apiKey } : {},
      });
      if (!res.ok) {
        this.logger.warn(
          `Résolution lid ${chatId} échouée: WAHA ${res.status}`,
        );
        this.lidCache.set(chatId, null);
        return null;
      }
      const contact = (await res.json()) as WahaContact;
      const number = contact.number?.replace(/[^0-9]/g, '');
      const lidDigits = chatId.split('@')[0];
      // WAHA Core renvoie souvent `number` = lid echo (mêmes chiffres). Dans
      // ce cas il n'y a pas de vrai numéro téléphone exposé.
      const isResolvable = number && number !== lidDigits;
      const phone = isResolvable ? `+${number}` : null;
      this.lidCache.set(chatId, phone);
      if (phone) {
        this.logger.debug(`🔁 lid résolu : ${chatId} → ${phone}`);
      } else {
        this.logger.debug(`🔁 lid non résoluble : ${chatId}`);
      }
      return phone;
    } catch (err) {
      this.logger.warn(
        `Résolution lid ${chatId} erreur: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.lidCache.set(chatId, null);
      return null;
    }
  }

  /**
   * Convertit un numéro E.164 (+221776583181) en chat id WAHA (221776583181@c.us).
   */
  private toChatId(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    return `${digits}@c.us`;
  }

  /**
   * Convertit un chat id WAHA `@c.us` en numéro E.164.
   * ⚠️ Ne marche PAS pour les `@lid` (ID interne, pas un numéro). Utiliser
   * `resolvePhoneFromChatId` à la place pour gérer les deux cas.
   */
  static chatIdToPhone(chatId: string): string {
    if (chatId.includes('@lid')) return '';
    const digits = chatId.split('@')[0]?.replace(/[^0-9]/g, '') ?? '';
    return digits ? `+${digits}` : '';
  }
}
