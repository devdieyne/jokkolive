import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Endpoints admin pour la vue financière de la plateforme.
 * Toutes les routes sont gardées par JwtAuthGuard + RolesGuard avec
 * @Roles('admin') au niveau classe.
 */
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  /**
   * Frais plateforme collectés (today, 7d, 30d, all-time) + top 5 vendeurs
   * par revenue. 1 seule aggregation Mongo via $facet.
   */
  @Get('revenue')
  getRevenue() {
    return this.adminStatsService.getRevenue();
  }
}
