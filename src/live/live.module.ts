import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LiveSession, LiveSessionSchema } from '../schemas/live-session.schema';
import { LiveService } from './live.service';
import { LiveController } from './live.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiveSession.name, schema: LiveSessionSchema },
    ]),
  ],
  providers: [LiveService],
  controllers: [LiveController],
  exports: [LiveService],
})
export class LiveModule {}
