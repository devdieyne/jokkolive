import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentLink,
  PaymentLinkSchema,
} from '../schemas/payment-link.schema';
import { Order, OrderSchema } from '../schemas/order.schema';
import { User, UserSchema } from '../schemas/user.schema';
import {
  SellerBalance,
  SellerBalanceSchema,
} from './schemas/seller-balance.schema';
import {
  BalanceTransaction,
  BalanceTransactionSchema,
} from './schemas/balance-transaction.schema';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { DiamanoPayWebhookController } from './diamanopay-webhook.controller';
import { BalanceService } from './balance.service';
import { PayoutService } from './payout.service';
import { DiamanoPayProvider } from './providers/diamanopay.provider';
import {
  PaymentProviderFactory,
  paymentProviderProvider,
} from './providers/payment-provider.factory';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentLink.name, schema: PaymentLinkSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: SellerBalance.name, schema: SellerBalanceSchema },
      { name: BalanceTransaction.name, schema: BalanceTransactionSchema },
      { name: Payout.name, schema: PayoutSchema },
    ]),
    forwardRef(() => WhatsappModule),
  ],
  providers: [
    PaymentsService,
    BalanceService,
    PayoutService,
    DiamanoPayProvider,
    PaymentProviderFactory,
    paymentProviderProvider,
  ],
  controllers: [PaymentsController, DiamanoPayWebhookController],
  exports: [PaymentsService, BalanceService],
})
export class PaymentsModule {}
