import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from './providers/whatsapp-provider.interface';

/**
 * Façade publique du module WhatsApp. Délègue tout au provider concret
 * (Meta Cloud API). Le reste de l'app utilise uniquement cette façade.
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
   * Envoie un OTP (login). Côté Cloud : texte simple, qui ne fonctionne
   * que si le user a écrit au numéro business dans les 24h. Le call-site
   * (auth.service.issueOtp) catche les erreurs sans planter et l'UI affiche
   * un fallback "écrire LOGIN sur WhatsApp".
   */
  sendOtp(phone: string, code: string): Promise<void> {
    return this.provider.sendOtp(phone, code);
  }

  /** Accès direct au provider — utile pour des méthodes Cloud-spécifiques
   *  (ex: sendTemplate). À utiliser avec parcimonie. */
  getProvider(): WhatsappProvider {
    return this.provider;
  }
}
