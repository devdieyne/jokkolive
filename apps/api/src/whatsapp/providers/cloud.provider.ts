import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappProvider } from './whatsapp-provider.interface';

interface CloudErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface CloudSendResponse extends CloudErrorResponse {
  messages?: { id: string }[];
  contacts?: { input: string; wa_id: string }[];
}

/**
 * Provider Meta WhatsApp Business Cloud API.
 *
 * Doc : https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Différences notables vs WAHA :
 *  - Officiel & stable, pas de risque de ban
 *  - **Fenêtre 24h** : message libre uniquement dans les 24h après le dernier
 *    message du client. Hors fenêtre → template approuvé obligatoire.
 *  - Pas de notion de `@lid` : l'identifiant entrant `wa_id` est déjà un E.164
 *    sans `+`. Toujours résoluble.
 *  - Webhook payload différent (cf. CloudWebhookController).
 *
 * Templates :
 *  - cf. `sendTemplate()` pour les messages hors fenêtre 24h (confirmation
 *    paiement tardive, etc.)
 */
@Injectable()
export class CloudProvider implements WhatsappProvider {
  private readonly logger = new Logger(CloudProvider.name);

  private readonly graphVersion: string;
  private readonly phoneNumberId: string;
  private readonly token: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.graphVersion =
      this.configService.get<string>('WHATSAPP_CLOUD_GRAPH_VERSION') ?? 'v21.0';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID') ?? '';
    this.token = this.configService.get<string>('WHATSAPP_CLOUD_TOKEN') ?? '';
    this.enabled = !!(this.phoneNumberId && this.token);

    if (!this.enabled) {
      this.logger.warn(
        '⚠️  Meta Cloud API non configuré (manque WHATSAPP_CLOUD_PHONE_NUMBER_ID ou WHATSAPP_CLOUD_TOKEN). Les messages seront loggés.',
      );
    }
  }

  async sendText(recipient: string, text: string): Promise<void> {
    const to = this.normalizeWaId(recipient);

    if (!this.enabled) {
      this.logger.log(`[DRY-RUN WhatsApp/Cloud] → ${to} : ${text}`);
      return;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
          }),
        },
      );

      const data = (await res.json().catch(() => ({}))) as CloudSendResponse;

      if (!res.ok) {
        throw new Error(
          `Cloud API ${res.status}: ${data.error?.message ?? 'unknown'} (code=${data.error?.code ?? '?'})`,
        );
      }

      this.logger.debug(
        `✉️  WhatsApp/Cloud envoyé à ${to} (id=${data.messages?.[0]?.id ?? '?'})`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec envoi Cloud à ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "Impossible d'envoyer le message WhatsApp pour le moment.",
      );
    }
  }

  /**
   * Envoie un template approuvé (pour sortir de la fenêtre 24h).
   *
   * @param to             E.164 destinataire
   * @param templateName   nom exact tel qu'approuvé dans WhatsApp Manager
   * @param languageCode   ex. `fr` ou `fr_FR`
   * @param components     variables `{{1}}, {{2}}…` du template
   *
   * Exemple : `await provider.sendTemplate('+221776…', 'order_confirmation',
   *   'fr', [{ type: 'body', parameters: [
   *     { type: 'text', text: 'Aïssa' },
   *     { type: 'text', text: 'JK-ABC123' },
   *   ]}])`
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components: unknown[] = [],
  ): Promise<void> {
    const recipient = this.normalizeWaId(to);

    if (!this.enabled) {
      this.logger.log(
        `[DRY-RUN WhatsApp/Cloud TPL] → ${recipient} : ${templateName} (${languageCode})`,
      );
      return;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode },
              ...(components.length ? { components } : {}),
            },
          }),
        },
      );

      const data = (await res.json().catch(() => ({}))) as CloudSendResponse;
      if (!res.ok) {
        throw new Error(
          `Cloud API TPL ${res.status}: ${data.error?.message ?? 'unknown'}`,
        );
      }
      this.logger.debug(
        `✉️  WhatsApp/Cloud template '${templateName}' envoyé à ${recipient}`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec template Cloud à ${recipient}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        "Impossible d'envoyer le template WhatsApp pour le moment.",
      );
    }
  }

  /**
   * Envoie un OTP via le template AUTHENTICATION configuré.
   *
   * Le nom du template + la langue sont configurables via env :
   *  - `WHATSAPP_CLOUD_OTP_TEMPLATE` (ex. `otp_login`)
   *  - `WHATSAPP_CLOUD_OTP_LANGUAGE` (ex. `fr` ou `fr_FR`)
   *
   * Format requis pour un template `AUTHENTICATION` Meta :
   *  - 1 paramètre `body` = le code (texte plain)
   *  - 1 paramètre `button` de sous-type `url` à l'index 0 = le code à
   *    copier (Meta génère automatiquement le bouton "Copy code")
   *
   * Doc : https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates
   */
  async sendOtp(phone: string, code: string): Promise<void> {
    const templateName =
      this.configService.get<string>('WHATSAPP_CLOUD_OTP_TEMPLATE') ??
      'otp_login';
    const language =
      this.configService.get<string>('WHATSAPP_CLOUD_OTP_LANGUAGE') ?? 'fr';

    await this.sendTemplate(phone, templateName, language, [
      {
        type: 'body',
        parameters: [{ type: 'text', text: code }],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: code }],
      },
    ]);
  }

  /**
   * Cloud API : `wa_id` reçu via webhook = E.164 sans `+`. Toujours résoluble,
   * pas de notion de lid.
   */
  resolvePhoneFromChatId(chatId: string): Promise<string | null> {
    const digits = chatId.replace(/[^0-9]/g, '');
    return Promise.resolve(digits ? `+${digits}` : null);
  }

  /**
   * Convertit un E.164 (`+221xxx`), un wa_id brut (`221xxx`) ou même un
   * chatId WAHA legacy (`221xxx@c.us`) vers le format Cloud (`221xxx`,
   * digits only).
   */
  private normalizeWaId(input: string): string {
    return input.replace(/[^0-9]/g, '');
  }
}
