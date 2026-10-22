import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const GLOBAL_PREFIX = 'api';

/** Global HTTP setup, shared by `main.ts` and the e2e tests so they test the real configuration. */
export function configureApp(app: INestApplication): void {
  // The API is only reached through nginx (Docker network) or the dev proxy (localhost): trust their
  // X-Forwarded-For so rate limits apply to the real visitor IP. Don't expose the backend port publicly.
  (app as NestExpressApplication).set('trust proxy', 'loopback, uniquelocal');
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
