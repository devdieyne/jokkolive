import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import { DiamanoPayWebhookDto } from './dto/diamanopay-webhook.dto';
import { PaymentsService } from './payments.service';
import { BalanceService } from './balance.service';
import { PayoutService } from './payout.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './providers/payment-provider.interface';

/**
 * Webhook DiamanoPay → JokkoLive.
 *
 * On NE FAIT PAS confiance au payload tel quel : on récupère
 * l'`transactionId`, on appelle `GET /api/transaction/{id}` côté PSP
 * pour récupérer l'état authoritative, et seulement alors on crédite.
 *
 * Idempotence : si `link.status === 'paid'` déjà, on ack 200 sans rien faire.
 */
@Controller('webhooks/diamanopay')
export class DiamanoPayWebhookController {
  private readonly logger = new Logger(DiamanoPayWebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly balanceService: BalanceService,
    private readonly payoutService: PayoutService,
    @Inject(PAYMENT_PROVIDER) private readonly psp: PaymentProvider,
  ) {}

  @Post()
  @HttpCode(200)
  async onWebhook(
    @Body() body: DiamanoPayWebhookDto,
  ): Promise<{ received: true }> {
    if (!body?.transactionId) {
      this.logger.warn('Webhook sans transactionId — ignoré');
      return { received: true };
    }
    this.logger.log(
      `webhook-received transactionId=${body.transactionId} status=${body.status ?? '?'}`,
    );

    let tx;
    try {
      tx = await this.psp.getTransaction(body.transactionId);
    } catch (err) {
      this.logger.error(
        `Vérification transaction ${body.transactionId} échouée: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Ack quand même — DiamanoPay re-tentera plus tard si configuré.
      return { received: true };
    }

    if (tx.status !== 'SUCCESS') {
      this.logger.log(
        `webhook ignoré (status=${tx.status}) transactionId=${body.transactionId}`,
      );
      return { received: true };
    }

    const tokenFromExtra =
      typeof body.extraData?.paymentLinkToken === 'string'
        ? (body.extraData.paymentLinkToken as string)
        : undefined;

    let link = null;
    if (tokenFromExtra) {
      try {
        link = await this.paymentsService.getByToken(tokenFromExtra);
      } catch {
        link = null;
      }
    }
    if (!link && tx.clientReference) {
      // Format: JK-<orderId>-<token>
      const parts = tx.clientReference.split('-');
      const tokenFromRef = parts.length >= 3 ? parts[parts.length - 1] : null;
      if (tokenFromRef) {
        try {
          link = await this.paymentsService.getByToken(tokenFromRef);
        } catch {
          link = null;
        }
      }
    }
    if (!link) {
      link = await this.paymentsService.findByPspChargeId(tx.id);
    }

    if (!link) {
      this.logger.warn(
        `webhook: PaymentLink introuvable pour transactionId=${body.transactionId}`,
      );
      return { received: true };
    }

    if (link.status === 'paid') {
      this.logger.log(
        `webhook idempotent: link ${link.token} déjà payé`,
      );
      return { received: true };
    }
    if (link.status !== 'pending') {
      this.logger.warn(
        `webhook: link ${link.token} status=${link.status} — abandon`,
      );
      return { received: true };
    }

    if (Math.abs(tx.amount) !== link.amount) {
      this.logger.warn(
        `webhook: montant mismatch link=${link.amount} tx=${Math.abs(tx.amount)} — on continue (avertissement seulement)`,
      );
    }

    await this.balanceService.creditFromPayment(link, tx);

    // Auto-payout fire-and-forget : on ne bloque pas la réponse webhook
    // (DiamanoPay attend un 200 rapide). triggerAutoPayout ne throw jamais
    // — il gère lui-même les notifications en cas d'échec.
    // Après creditFromPayment, link a été mis à jour avec sellerNet et
    // paymentMethodUsed (cf. balance.service.ts).
    const sellerNet = link.sellerNet ?? 0;
    const provider = link.paymentMethodUsed;
    if (sellerNet > 0 && provider) {
      void this.payoutService
        .triggerAutoPayout(link.sellerId.toString(), sellerNet, provider)
        .catch((err) =>
          this.logger.error(
            `triggerAutoPayout error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

    return { received: true };
  }
}
