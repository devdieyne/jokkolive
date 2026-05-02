/**
 * Contrat du provider WhatsApp utilisé par l'application.
 *
 * Une seule implémentation réelle aujourd'hui : `CloudProvider` (Meta
 * WhatsApp Business Cloud API). L'interface est conservée pour permettre
 * le mock en tests et faciliter une éventuelle bascule de provider.
 */
export interface WhatsappProvider {
  /**
   * Envoie un message texte.
   *
   * @param recipient soit un E.164 (`+221776583181`), soit un wa_id Cloud
   *                  (E.164 sans `+`). Pour répondre dans un fil entrant,
   *                  repasser l'identifiant reçu via webhook.
   */
  sendText(recipient: string, text: string): Promise<void>;

  /**
   * Convertit un identifiant de chat entrant (webhook) en E.164.
   * Cloud API : le `wa_id` est déjà un E.164 sans `+` → toujours résoluble.
   */
  resolvePhoneFromChatId(chatId: string): Promise<string | null>;

  /**
   * Envoie un OTP (code de connexion). Implémentation actuelle Cloud :
   * texte simple — fonctionne uniquement si le user a écrit au business
   * dans les 24h (sinon Meta refuse). Le call-site gère le fallback UI.
   */
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Token d'injection NestJS pour le provider WhatsApp actif. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
