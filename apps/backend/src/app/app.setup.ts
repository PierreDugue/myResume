import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LiveIoAdapter } from './live/live-io.adapter';

export const GLOBAL_PREFIX = 'api';

/** Global HTTP and Socket.IO setup, shared by `main.ts` and the e2e tests so they test the real configuration. */
export function configureApp(app: INestApplication): void {
  // The API is only reached through nginx (Docker network) or the dev proxy (localhost): trust their
  // X-Forwarded-For so rate limits apply to the real visitor IP. Don't expose the backend port publicly.
  (app as NestExpressApplication).set('trust proxy', 'loopback, uniquelocal');
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Socket.IO on /api/socket.io, with the proxy-secret and per-IP connection checks at the handshake.
  app.useWebSocketAdapter(new LiveIoAdapter(app));
  app.enableShutdownHooks();
}
