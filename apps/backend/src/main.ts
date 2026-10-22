import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp, GLOBAL_PREFIX } from './app/app.setup';
import type { AppEnv } from './app/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = app.get(ConfigService<AppEnv, true>).get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}/${GLOBAL_PREFIX}`, 'Bootstrap');
}

void bootstrap();
