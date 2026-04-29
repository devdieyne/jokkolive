import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from './providers/whatsapp-provider.interface';

/**
 * Façade publique du module WhatsApp.
 *
 * Délègue tout au provider concret (WAHA ou Meta Cloud API) sélectionné par
 * `WHATSAPP_PROVIDER` dans la config. Le reste de l'app n'a pas à savoir
 * lequel est actif.
 */
@Injectable()
export class WhatsappService {
  constructor(
    @Inject(WHATSAPP_PROVIDER)
    private readonly provider: WhatsappProvider,
  ) {}

  sendText(recipient: string, text: string): Promise<void> {
    return this.provider.sendText(recipient, text);
  }

  resolvePhoneFromChatId(chatId: string): Promise<string | null> {
    return this.provider.resolvePhoneFromChatId(chatId);
  }

  /**
   * Envoie un code OTP (signup/login). Utilise un template AUTHENTICATION
   * côté Cloud (obligatoire pour initier la conversation), un texte simple
   * côté WAHA.
   */
  sendOtp(phone: string, code: string): Promise<void> {
    return this.provider.sendOtp(phone, code);
  }

  /** Accès direct au provider (utile pour appeler des méthodes spécifiques
   *  comme `sendTemplate` côté Cloud, ou des hooks WAHA). À utiliser avec
   *  parcimonie — préférer ajouter une méthode à la façade. */
  getProvider(): WhatsappProvider {
    return this.provider;
  }

  /**
   * Helper rétro-compatible : utilisé par certains call-sites legacy.
   * Pour Cloud API c'est juste un strip de `@`/`+`.
   */
  static chatIdToPhone(chatId: string): string {
    if (chatId.includes('@lid')) return '';
    const digits = chatId.split('@')[0]?.replace(/[^0-9]/g, '') ?? '';
    return digits ? `+${digits}` : '';
  }
}
