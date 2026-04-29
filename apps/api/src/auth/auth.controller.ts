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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.phone, dto.pseudo, dto.displayName);
  }

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
