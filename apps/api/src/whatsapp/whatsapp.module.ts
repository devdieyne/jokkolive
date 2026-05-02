import { Logger, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { CloudWebhookController } from './cloud-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { WahaProvider } from './providers/waha.provider';
import { CloudProvider } from './providers/cloud.provider';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';

/**
 * Sélectionne le provider WhatsApp actif depuis la config.
 *
 * `WHATSAPP_PROVIDER` peut valoir :
 *  - `waha`  (défaut) → WAHA self-hosted
 *  - `cloud` → Meta WhatsApp Business Cloud API
 *
 * Les deux providers sont instanciés (le coût est nul, juste un constructor)
 * pour permettre une bascule à chaud en changeant l'env. Seul celui injecté
 * via le token `WHATSAPP_PROVIDER` est utilisé par WhatsappService.
 */
const whatsappProviderFactory: Provider = {
  provide: WHATSAPP_PROVIDER,
  useFactory: (
    config: ConfigService,
    waha: WahaProvider,
    cloud: CloudProvider,
  ) => {
    // On lit les deux sources : le bloc nommé `whatsapp.provider` (loader
    // configuration.ts) et la flat env `WHATSAPP_PROVIDER`. Selon comment
    // l'app est lancée (docker, npm run, env file vs env shell), une seule
    // des deux peut être renseignée.
    const raw =
      config.get<string>('whatsapp.provider') ??
      config.get<string>('WHATSAPP_PROVIDER') ??
      process.env.WHATSAPP_PROVIDER ??
      'waha';
    const choice = raw.trim().toLowerCase();
    const logger = new Logger('WhatsappModule');
    if (choice === 'cloud') {
      logger.log('🌐 Provider WhatsApp actif : Meta Cloud API');
      return cloud;
    }
    if (choice !== 'waha') {
      logger.warn(
        `WHATSAPP_PROVIDER='${raw}' inconnu — fallback sur 'waha'. Valeurs acceptées : waha | cloud.`,
      );
    }
    logger.log('🌐 Provider WhatsApp actif : WAHA');
    return waha;
  },
  inject: [ConfigService, WahaProvider, CloudProvider],
};

@Module({
  imports: [forwardRef(() => OrdersModule), forwardRef(() => AuthModule)],
  providers: [WahaProvider, CloudProvider, whatsappProviderFactory, WhatsappService],
  controllers: [WhatsappController, CloudWebhookController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
