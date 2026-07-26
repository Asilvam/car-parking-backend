import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SantiagoLogger } from './common/logging/santiago.logger';
import { SANTIAGO_TIME_ZONE } from './common/logging/santiago-time';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  process.env.TZ = SANTIAGO_TIME_ZONE;

  const app = await NestFactory.create(AppModule, {
    logger: new SantiagoLogger(),
  });
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:5173',
  );
  const frontendUrls = configService
    .get<string>('FRONTEND_URLS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    frontendUrl,
    ...frontendUrls,
  ]);

  const frontendUrls = configService
    .get<string>('FRONTEND_URLS', '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const primaryFrontend = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3000',
  );

  const allowedOrigins = Array.from(
    new Set([primaryFrontend, ...frontendUrls]),
  );

  const wildcardSuffixes = allowedOrigins
    .filter((origin) => origin.startsWith('*.'))
    .map((origin) => origin.slice(1));

  const staticOrigins = allowedOrigins.filter(
    (origin) => !origin.startsWith('*.'),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin no permitido por CORS'));
    },
  });

  await app.listen(configService.get<number>('PORT', 3500));
}
bootstrap();
