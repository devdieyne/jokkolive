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

  /**
   * Envoie un OTP (code de connexion / signup) au destinataire.
   *
   * - Cloud : utilise un template `AUTHENTICATION` approuvé (obligatoire car
   *   on initie la conversation hors fenêtre 24h)
   * - WAHA  : envoie un message texte simple ; pas de notion de template
   *
   * @param phone E.164
   * @param code  code numérique généré côté caller (ex. 6 chiffres)
   */
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Token d'injection NestJS pour le provider WhatsApp actif. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
