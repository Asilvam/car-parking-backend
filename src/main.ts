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

  app.enableCors({
    origin: configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    ),
  });

  await app.listen(configService.get<number>('PORT', 3001));
}
bootstrap();
