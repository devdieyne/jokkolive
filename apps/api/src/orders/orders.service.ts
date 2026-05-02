import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { ProductsService } from '../products/products.service';
import { PaymentsService } from '../payments/payments.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UpdateOrderDto } from './dto/update-order.dto';

interface IncomingMessage {
  buyerPhone: string;
  buyerChatId: string;
  buyerName?: string;
  pseudo: string;
  code: string;
  rawMessage: string;
}

/**
 * Génère une référence commande courte et lisible (8 caractères utiles).
 * Format : `JK-XXXXXX` où XXXXXX utilise un alphabet sans caractères ambigus
 * (pas de 0/O, 1/I/L). 30^6 ≈ 729M combinaisons → collision improbable au
 * volume MVP, et la contrainte unique en DB protège quand même.
 */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function generateOrderReference(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `JK-${suffix}`;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * Point d'entrée appelé par le webhook WAHA quand un acheteur écrit
   * `@pseudo:CODE`. On crée la commande, le lien de paiement et on
   * répond à l'acheteur sur WhatsApp.
   */
  async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    const found = await this.productsService.findByPseudoAndCode(
      msg.pseudo,
      msg.code,
    );

    if (!found) {
      await this.whatsappService.sendText(
        msg.buyerChatId,
        `Désolé, aucun produit "${msg.code}" trouvé chez @${msg.pseudo}. Vérifie le pseudo et le code, puis réessaie.`,
      );
      return;
    }

    const { product, seller } = found;

    if (product.disabled) {
      await this.whatsappService.sendText(
        msg.buyerChatId,
        `Le produit ${product.code} (${product.name}) n'est plus disponible.`,
      );
      return;
    }

    const quantity = 1;
    const totalAmount = product.price * quantity;

    // Décrément atomique du stock — race-safe via findOneAndUpdate.
    // Si quelqu'un d'autre vient de prendre le dernier exemplaire entre la
    // lecture du `product` et ici, on échoue ici proprement.
    const stockOk = await this.productsService.tryDecrementStock(
      product._id as Types.ObjectId,
      quantity,
    );
    if (!stockOk) {
      await this.whatsappService.sendText(
        msg.buyerChatId,
        `Le produit ${product.code} (${product.name}) est en rupture de stock.`,
      );
      return;
    }

    // À partir d'ici le stock est réservé : on doit le restaurer en cas
    // d'échec de création de commande ou de lien de paiement, sinon on aura
    // un stock fantôme bloqué.
    let order;
    let link;
    try {
      // Retry sur collision de référence (improbable mais cheap à protéger).
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          order = await this.orderModel.create({
            reference: generateOrderReference(),
            sellerId: seller._id,
            productId: product._id,
            productName: product.name,
            productCode: product.code,
            quantity,
            unitPrice: product.price,
            totalAmount,
            currency: product.currency,
            buyerPhone: msg.buyerPhone,
            buyerName: msg.buyerName,
            rawMessage: msg.rawMessage,
            status: 'pending',
          });
          break;
        } catch (err: unknown) {
          const code = (err as { code?: number })?.code;
          if (code === 11000 && attempt < 4) {
            this.logger.warn('Collision référence commande — retry');
            continue;
          }
          throw err;
        }
      }
      if (!order) {
        throw new Error('Impossible de générer une référence unique');
      }

      link = await this.paymentsService.createLink({
        orderId: order._id as Types.ObjectId,
        sellerId: seller._id as Types.ObjectId,
        amount: totalAmount,
        currency: product.currency,
      });

      order.paymentLinkId = link._id as Types.ObjectId;
      await order.save();
    } catch (err) {
      // Rollback du stock pour ne pas bloquer le produit.
      await this.productsService
        .restoreStock(product._id as Types.ObjectId, quantity)
        .catch((restoreErr) =>
          this.logger.error(
            `Restore stock échoué après échec création commande: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}`,
          ),
        );
      throw err;
    }

    const url = this.paymentsService.buildUrl(link.token);

    // Confirmation à l'acheteur
    await this.whatsappService.sendText(
      msg.buyerChatId,
      [
        `🛒 Commande ${order.reference} enregistrée chez @${msg.pseudo}`,
        ``,
        `Produit : ${product.name} (${product.code})`,
        `Montant : ${totalAmount} ${product.currency}`,
        ``,
        `Paie ici (lien valable 24h) :`,
        url,
      ].join('\n'),
    );

    // Notification au vendeur
    await this.whatsappService.sendText(
      seller.phone,
      [
        `🔔 Nouvelle commande ${order.reference}`,
        ``,
        `Produit : ${product.name} (${product.code})`,
        `Acheteur : ${msg.buyerName ?? msg.buyerPhone}`,
        `Numéro : ${msg.buyerPhone}`,
        `Montant : ${totalAmount} ${product.currency}`,
      ].join('\n'),
    );
  }

  async findAllForSeller(sellerId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
  }

  async findOneOwned(
    orderId: string,
    sellerId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.sellerId.toString() !== sellerId) {
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    }
    return order;
  }

  async update(
    orderId: string,
    sellerId: string,
    dto: UpdateOrderDto,
  ): Promise<OrderDocument> {
    const order = await this.findOneOwned(orderId, sellerId);

    if (dto.status !== undefined && dto.status !== order.status) {
      const wasReservingStock = order.status === 'pending';
      const goingToReleaseStock =
        dto.status === 'cancelled' || dto.status === 'expired';

      order.status = dto.status;
      if (dto.status === 'paid' && !order.paidAt) order.paidAt = new Date();

      // Restauration du stock SEULEMENT si on passe de pending → annulée
      // ou expirée. On ne restaure pas après "paid" (la vente est faite,
      // un éventuel remboursement est un flow distinct).
      if (wasReservingStock && goingToReleaseStock) {
        await this.productsService
          .restoreStock(order.productId, order.quantity)
          .catch((err) =>
            this.logger.warn(
              `restore stock échoué pour commande ${order.reference}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
    }
    if (dto.buyerName !== undefined) order.buyerName = dto.buyerName;
    return order.save();
  }
}
