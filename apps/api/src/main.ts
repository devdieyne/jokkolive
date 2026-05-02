// IMPORTANT : ce side-effect import doit rester EN PREMIER. Il enregistre
// le plugin Mongoose qui transforme `_id`→`id` et masque `__v` sur toutes
// les réponses JSON. Doit être chargé AVANT AppModule (sinon les schemas
// compilés via SchemaFactory.createForClass au moment de l'import des
// modules ne récupéreraient pas le plugin).
import './common/mongoose-id-transform';

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
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  // CORS : en prod on EXIGE une origine explicite — sinon on bloque pour
  // ne pas exposer l'API à n'importe quel domaine.
  const isProd =
    (configService.get<string>('nodeEnv') ?? 'development') === 'production';
  const corsOrigin = configService.get<string>('cors.origin');
  if (isProd && (!corsOrigin || corsOrigin === '*')) {
    throw new Error(
      'CORS_ORIGIN must be set to a specific domain in production (refus du wildcard `*`).',
    );
  }
  app.enableCors({ origin: corsOrigin ?? '*' });

  // Webhooks en prod : si le secret HMAC est manquant → un attaquant peut
  // forger des événements (faux paiements, faux messages WhatsApp). On log
  // loud pour que ça soit immédiatement visible dans les dashboards Cloud Run.
  if (
    isProd &&
    !configService.get<string>('whatsapp.cloud.appSecret')
  ) {
    logger.warn(
      '⚠️  WHATSAPP_CLOUD_APP_SECRET vide en PROD — la signature HMAC du webhook Cloud n\'est PAS vérifiée. À configurer avant tout trafic réel.',
    );
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`🚀 App running on http://localhost:${port}`);
}

bootstrap();
