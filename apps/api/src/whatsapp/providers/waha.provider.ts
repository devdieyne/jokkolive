import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappProvider } from './whatsapp-provider.interface';

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
 * Provider WAHA — WhatsApp HTTP API self-hosted.
 * Doc : https://waha.devlike.pro/docs/overview
 *
 * Avantages : gratuit, pas de business verification.
 * Inconvénients : non officiel, ban possible, pas de templates, lid issue.
 */
@Injectable()
export class WahaProvider implements WhatsappProvider {
  private readonly logger = new Logger(WahaProvider.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly session: string;
  private readonly enabled: boolean;

  /** Cache lid → E.164 (le lid est stable pour un compte donné). */
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

  async sendText(recipient: string, text: string): Promise<void> {
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
      : WahaProvider.chatIdToPhone(chatId) || chatId;

    if (!this.enabled) {
      this.logger.log(`[DRY-RUN WhatsApp/WAHA] → ${displayId} : ${text}`);
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
          /* WAHA peut renvoyer 200 sans body */
        }
      }
      this.logger.debug(
        `✉️  WhatsApp/WAHA envoyé à ${displayId} (id=${typeof data.id === 'string' ? data.id : '?'})`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec envoi WAHA à ${displayId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "Impossible d'envoyer le message WhatsApp pour le moment.",
      );
    }
  }

  async resolvePhoneFromChatId(chatId: string): Promise<string | null> {
    if (!chatId.includes('@lid')) {
      return WahaProvider.chatIdToPhone(chatId) || null;
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

  private toChatId(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    return `${digits}@c.us`;
  }

  static chatIdToPhone(chatId: string): string {
    if (chatId.includes('@lid')) return '';
    const digits = chatId.split('@')[0]?.replace(/[^0-9]/g, '') ?? '';
    return digits ? `+${digits}` : '';
  }
}
