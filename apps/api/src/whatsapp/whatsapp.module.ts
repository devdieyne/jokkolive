import { Logger, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { CloudWebhookController } from './cloud-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
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
    const choice = (config.get<string>('WHATSAPP_PROVIDER') ?? 'waha')
      .trim()
      .toLowerCase();
    const logger = new Logger('WhatsappModule');
    if (choice === 'cloud') {
      logger.log('🌐 Provider WhatsApp actif : Meta Cloud API');
      return cloud;
    }
    logger.log('🌐 Provider WhatsApp actif : WAHA');
    return waha;
  },
  inject: [ConfigService, WahaProvider, CloudProvider],
};

@Module({
  imports: [forwardRef(() => OrdersModule)],
  providers: [WahaProvider, CloudProvider, whatsappProviderFactory, WhatsappService],
  controllers: [WhatsappController, CloudWebhookController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
