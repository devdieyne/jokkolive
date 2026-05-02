import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentLink,
  PaymentLinkDocument,
} from '../schemas/payment-link.schema';

export interface RevenueBucket {
  /** Total des frais plateforme collectés sur la période (FCFA). */
  totalFee: number;
  /** Volume brut des paiements (montant total payé par les acheteurs). */
  totalGross: number;
  /** Nombre de paiements confirmés sur la période. */
  count: number;
}

export interface AdminRevenueResponse {
  allTime: RevenueBucket;
  last30d: RevenueBucket;
  last7d: RevenueBucket;
  today: RevenueBucket;
  /** Top 5 vendeurs par frais générés (all-time). */
  topSellers: Array<{
    sellerId: string;
    pseudo: string;
    displayName: string;
    totalFee: number;
    count: number;
  }>;
}

const EMPTY_BUCKET: RevenueBucket = { totalFee: 0, totalGross: 0, count: 0 };

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectModel(PaymentLink.name)
    private readonly linkModel: Model<PaymentLinkDocument>,
  ) {}

  /**
   * Agrège les frais plateforme collectés (sum de PaymentLink.platformFee
   * où status='paid') sur plusieurs fenêtres temporelles + top vendeurs.
   *
   * Tout en une seule passe avec `$facet` Mongo : 1 round-trip DB.
   */
  async getRevenue(): Promise<AdminRevenueResponse> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sumProjection = {
      _id: null,
      totalFee: { $sum: { $ifNull: ['$platformFee', 0] } },
      totalGross: { $sum: { $ifNull: ['$amount', 0] } },
      count: { $sum: 1 },
    };

    type AggResult = {
      allTime: { totalFee: number; totalGross: number; count: number }[];
      last30d: { totalFee: number; totalGross: number; count: number }[];
      last7d: { totalFee: number; totalGross: number; count: number }[];
      today: { totalFee: number; totalGross: number; count: number }[];
      topSellers: {
        _id: { sellerId: unknown; pseudo: string; displayName: string };
        totalFee: number;
        count: number;
      }[];
    };

    const [agg] = (await this.linkModel.aggregate<AggResult>([
      { $match: { status: 'paid' } },
      {
        $facet: {
          allTime: [{ $group: sumProjection }],
          last30d: [
            { $match: { paidAt: { $gte: start30d } } },
            { $group: sumProjection },
          ],
          last7d: [
            { $match: { paidAt: { $gte: start7d } } },
            { $group: sumProjection },
          ],
          today: [
            { $match: { paidAt: { $gte: startOfDay } } },
            { $group: sumProjection },
          ],
          topSellers: [
            {
              $lookup: {
                from: 'users',
                localField: 'sellerId',
                foreignField: '_id',
                as: 'seller',
              },
            },
            { $unwind: '$seller' },
            {
              $group: {
                _id: {
                  sellerId: '$sellerId',
                  pseudo: '$seller.pseudo',
                  displayName: '$seller.displayName',
                },
                totalFee: { $sum: { $ifNull: ['$platformFee', 0] } },
                count: { $sum: 1 },
              },
            },
            { $sort: { totalFee: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ])) as unknown as [AggResult];

    const bucket = (
      arr: { totalFee: number; totalGross: number; count: number }[] | undefined,
    ): RevenueBucket => {
      const first = arr?.[0];
      return first
        ? {
            totalFee: first.totalFee ?? 0,
            totalGross: first.totalGross ?? 0,
            count: first.count ?? 0,
          }
        : EMPTY_BUCKET;
    };

    return {
      allTime: bucket(agg?.allTime),
      last30d: bucket(agg?.last30d),
      last7d: bucket(agg?.last7d),
      today: bucket(agg?.today),
      topSellers: (agg?.topSellers ?? []).map((s) => ({
        sellerId: String(s._id.sellerId),
        pseudo: s._id.pseudo,
        displayName: s._id.displayName,
        totalFee: s.totalFee,
        count: s.count,
      })),
    };
  }
}
