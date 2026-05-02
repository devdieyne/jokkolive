import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { CloudWebhookController } from './cloud-webhook.controller';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { CloudProvider } from './providers/cloud.provider';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';

/**
 * Module WhatsApp — provider unique : Meta Cloud API.
 *
 * L'interface `WhatsappProvider` est conservée pour faciliter le mock en
 * tests, mais il n'y a plus qu'une implémentation réelle (CloudProvider).
 */
@Module({
  imports: [forwardRef(() => OrdersModule), forwardRef(() => AuthModule)],
  providers: [
    CloudProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: CloudProvider },
    WhatsappService,
  ],
  controllers: [CloudWebhookController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
