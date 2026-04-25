import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderItem } from '../schemas/order.schema';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';

interface OrderFilters {
  sellerId?: string;
  liveSessionId?: string;
  status?: string;
}

interface Pagination {
  limit?: number;
  skip?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findAll(
    filters: OrderFilters,
    pagination: Pagination = {},
  ): Promise<OrderDocument[]> {
    const query: Record<string, unknown> = {};
    if (filters.sellerId) query.sellerId = filters.sellerId;
    if (filters.liveSessionId)
      query.liveSessionId = new Types.ObjectId(filters.liveSessionId);
    if (filters.status) query.status = filters.status;

    return this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(pagination.skip ?? 0)
      .limit(pagination.limit ?? 50)
      .exec();
  }

  async findOne(id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderDocument> {
    const order = await this.findOne(id);

    if (dto.buyerPhone !== undefined) order.buyerPhone = dto.buyerPhone;

    if (dto.quantity !== undefined || dto.variant !== undefined) {
      const item = order.items[0] as OrderItem | undefined;
      if (item) {
        if (dto.quantity !== undefined) {
          item.quantity = dto.quantity;
          order.totalFCFA = item.unitPriceFCFA * dto.quantity;
        }
        if (dto.variant !== undefined) {
          item.variant = new Map(Object.entries(dto.variant));
        }
        order.markModified('items');
      }
    }

    return order.save();
  }

  async confirm(id: string, dto: ConfirmOrderDto): Promise<OrderDocument> {
    const order = await this.findOne(id);
    order.status = 'confirmed';
    if (dto.buyerPhone) order.buyerPhone = dto.buyerPhone;
    return order.save();
  }

  async cancel(id: string): Promise<OrderDocument> {
    const order = await this.findOne(id);
    order.status = 'cancelled';
    return order.save();
  }

  async exportToCsv(sessionId: string): Promise<string> {
    const orders = await this.orderModel
      .find({ liveSessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();

    const headers = [
      'Date',
      'Acheteur (TikTok)',
      'Téléphone',
      'Produit',
      'Variantes',
      'Quantité',
      'Total FCFA',
      'Statut',
      'Confiance IA',
    ];

    const escapeCell = (val: string): string =>
      `"${String(val).replace(/"/g, '""')}"`;

    const rows = orders.map((order) => {
      const item = order.items[0] as OrderItem | undefined;

      const variantStr = item?.variant
        ? [...(item.variant as Map<string, string>).entries()]
            .map(([k, v]) => `${k}:${v}`)
            .join('; ')
        : '';

      return [
        escapeCell(order.createdAt.toISOString()),
        escapeCell(order.buyerTiktokUsername),
        escapeCell(order.buyerPhone ?? ''),
        escapeCell(item?.productName ?? ''),
        escapeCell(variantStr),
        String(item?.quantity ?? 0),
        String(order.totalFCFA),
        escapeCell(order.status),
        `${(order.matchConfidence * 100).toFixed(0)}%`,
      ].join(',');
    });

    return [headers.map(escapeCell).join(','), ...rows].join('\n');
  }
}
