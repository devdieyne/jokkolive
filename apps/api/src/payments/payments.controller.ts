import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentsService } from './payments.service';
import { BalanceService } from './balance.service';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InitiateCheckoutDto } from './dto/initiate-checkout.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { UpdatePayoutAccountsDto } from './dto/update-payout-accounts.dto';
import { UpdateAutoPayoutDto } from './dto/update-auto-payout.dto';
import type { ChargeProvider } from './providers/payment-provider.interface';

interface AuthRequest {
  user: { id: string };
}

class MarkPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly balanceService: BalanceService,
    private readonly payoutService: PayoutService,
  ) {}

  // ── Public — page acheteur ────────────────────────────────────────────────

  @Get('pay/:token')
  async getPublicLink(@Param('token') token: string) {
    const link = await this.paymentsService.getByToken(token);
    return {
      token: link.token,
      amount: link.amount,
      currency: link.currency,
      status: link.status,
      expiresAt: link.expiresAt,
      paymentMethodUsed: link.paymentMethodUsed,
    };
  }

  @Post('pay/:token/checkout')
  async initiateCheckout(
    @Param('token') token: string,
    @Body() dto: InitiateCheckoutDto,
  ) {
    return this.paymentsService.initiateCheckout(token, dto.provider);
  }

  // ── Authentifié ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('payments/:token/mark-paid')
  markPaid(
    @Request() req: AuthRequest,
    @Param('token') token: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.paymentsService.markPaid(token, req.user.id, dto.externalRef);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/balances')
  async getMyBalances(@Request() req: AuthRequest) {
    const balances = await this.balanceService.listBalancesForSeller(
      req.user.id,
    );
    return balances.map((b) => ({
      provider: b.provider,
      available: b.available,
      pending: b.pending,
      currency: b.currency,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/balance/:provider/transactions')
  async getMyBalanceTransactions(
    @Request() req: AuthRequest,
    @Param('provider') provider: string,
    @Query('limit') limit?: string,
  ) {
    const p = provider.toUpperCase() as ChargeProvider;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.balanceService.listTransactions(
      req.user.id,
      p,
      Number.isNaN(parsedLimit) ? 50 : parsedLimit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/payouts')
  async getMyPayouts(
    @Request() req: AuthRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.payoutService.listForSeller(
      req.user.id,
      Number.isNaN(parsedLimit) ? 50 : parsedLimit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/payouts')
  async requestPayout(
    @Request() req: AuthRequest,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.payoutService.requestPayout(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/payout-accounts')
  async updatePayoutAccounts(
    @Request() req: AuthRequest,
    @Body() dto: UpdatePayoutAccountsDto,
  ) {
    const user = await this.paymentsService.updatePayoutAccounts(
      req.user.id,
      dto,
    );
    return { payoutAccounts: user.payoutAccounts ?? {} };
  }

  /**
   * Active/désactive le retrait automatique. Quand activé, à chaque paiement
   * reçu l'API tente un transfert immédiat vers le compte mobile money
   * correspondant au provider du paiement.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me/auto-payout')
  async updateAutoPayout(
    @Request() req: AuthRequest,
    @Body() dto: UpdateAutoPayoutDto,
  ) {
    const user = await this.paymentsService.updateAutoPayoutEnabled(
      req.user.id,
      dto.enabled,
    );
    return { autoPayoutEnabled: user.autoPayoutEnabled };
  }
}
