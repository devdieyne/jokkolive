import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { LiveService } from './live.service';
import { StartLiveDto } from './dto/start-live.dto';
import { StopLiveDto } from './dto/stop-live.dto';
import { SetCurrentProductDto } from './dto/set-current-product.dto';

@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Post('start')
  async startLive(@Body() dto: StartLiveDto) {
    const session = await this.liveService.startLive(
      dto.sellerId,
      dto.tiktokUsername,
    );
    return {
      sessionId: session._id,
      tiktokUsername: session.tiktokUsername,
      status: session.status,
    };
  }

  @Post('stop')
  async stopLive(@Body() dto: StopLiveDto) {
    await this.liveService.stopLive(dto.sellerId);
    return { status: 'stopped' };
  }

  @Post('current-product')
  async setCurrentProduct(@Body() dto: SetCurrentProductDto) {
    await this.liveService.setCurrentProduct(dto.sellerId, dto.productId);
    return { status: 'updated' };
  }

  @Get('active/:sellerId')
  getActiveSession(@Param('sellerId') sellerId: string) {
    return this.liveService.getActiveSession(sellerId);
  }

  @Get('sessions/:sellerId')
  getSessions(
    @Param('sellerId') sellerId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.liveService.getSessions(
      sellerId,
      limit ? parseInt(limit, 10) : 10,
      skip ? parseInt(skip, 10) : 0,
    );
  }
}
