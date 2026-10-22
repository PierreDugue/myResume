import { INestApplication, ValidationPipe } from '@nestjs/common';

export const GLOBAL_PREFIX = 'api';

/** Global HTTP setup, shared by `main.ts` and the e2e tests so they test the real configuration. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
