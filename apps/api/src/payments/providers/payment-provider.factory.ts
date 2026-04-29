import { Injectable, Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProvider } from './payment-provider.interface';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { DiamanoPayProvider } from './diamanopay.provider';

/**
 * Sélection statique du PSP actif au boot via `ACTIVE_PSP` (env).
 * Pour l'instant `diamanopay` est le seul implémenté. Pour ajouter
 * un Stripe : injecter ici, switcher selon `active`.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly diamanopay: DiamanoPayProvider,
  ) {}

  getActive(): PaymentProvider {
    const active = (
      this.configService.get<string>('ACTIVE_PSP') ?? 'diamanopay'
    ).toLowerCase();
    switch (active) {
      case 'diamanopay':
        return this.diamanopay;
      default:
        this.logger.warn(
          `ACTIVE_PSP=${active} inconnu, fallback sur diamanopay`,
        );
        return this.diamanopay;
    }
  }
}

export const paymentProviderProvider: Provider = {
  provide: PAYMENT_PROVIDER,
  inject: [PaymentProviderFactory],
  useFactory: (factory: PaymentProviderFactory): PaymentProvider =>
    factory.getActive(),
};
