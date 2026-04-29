/**
 * Contrat commun à tous les providers WhatsApp (WAHA, Meta Cloud API, …).
 *
 * Le reste de l'app ne connaît que cette interface — la sélection du provider
 * concret se fait via `WHATSAPP_PROVIDER` (cf. WhatsappModule).
 */
export interface WhatsappProvider {
  /**
   * Envoie un message texte.
   *
   * @param recipient soit un E.164 (`+221776583181`), soit un identifiant de
   *                  chat brut (chatId WAHA `@c.us`/`@lid`, ou wa_id Cloud).
   *                  Pour répondre dans le fil reçu via webhook, repasser
   *                  l'identifiant entrant.
   */
  sendText(recipient: string, text: string): Promise<void>;

  /**
   * Convertit un identifiant de chat entrant (webhook) en numéro E.164 stable.
   * Retourne `null` si non résoluble (lid privé, etc.).
   *
   * - WAHA  : `221xxx@c.us` → `+221xxx` ; `xxx@lid` → contacts API
   * - Cloud : le `wa_id` est déjà un E.164 sans `+`, toujours résoluble
   */
  resolvePhoneFromChatId(chatId: string): Promise<string | null>;
}

/** Token d'injection NestJS pour le provider WhatsApp actif. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
