import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // `rawBody: true` permet d'accéder à `req.rawBody` (Buffer) — nécessaire
  // pour vérifier la signature HMAC du webhook Meta WhatsApp Cloud API.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.use(helmet());

  const corsOrigin = configService.get<string>('cors.origin') ?? '*';
  app.enableCors({ origin: corsOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);

  Logger.log(`🚀 App running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
