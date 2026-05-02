import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
}

/**
 * L'inscription publique (POST /auth/register, POST /auth/magic/complete-signup)
 * est désactivée : seul un admin peut créer un compte via POST /users.
 * Les utilisateurs se connectent ensuite via OTP ou magic link.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  /**
   * Magic link : consomme le token reçu par WhatsApp et renvoie une session
   * JWT pour un compte existant. Si le token correspond à un compte inconnu,
   * désactivé ou expiré, l'endpoint répond 401/404.
   *
   * Rate-limit : 10 req/min/IP. Defense in depth — un token random 256 bits
   * est mathématiquement impossible à brute-forcer, mais on plafonne quand
   * même pour limiter le bruit logs et éviter qu'un IP scanne en boucle.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('magic/verify')
  @HttpCode(200)
  verifyMagic(@Body() dto: VerifyMagicLinkDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: AuthRequest) {
    return this.authService.getMe(req.user.id);
  }

  @Patch('me/currency')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  updateCurrency(
    @Request() req: AuthRequest,
    @Body() dto: UpdateCurrencyDto,
  ) {
    return this.authService.updateCurrency(req.user.id, dto.currency);
  }
}
