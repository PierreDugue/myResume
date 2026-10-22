import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { validateEnv } from '../app/config/env.validation';

export const TEST_ADMIN = { email: 'admin@test.local', password: 'integration-test-password' };

/** Content tables, emptied between tests (the admin account is kept). */
const CONTENT_TABLES = [
  'experience_skill',
  'project_skill',
  'highlight',
  'experience',
  'project',
  'education',
  'skill',
  'profile',
];

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  /** A valid admin token. */
  token: string;
  truncateContent(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Starts the real backend (AppModule: migrations, seed, guards, validation) on a new, empty
 * PostgreSQL database, signs the test admin in, and drops the database on `close()`.
 * Connection settings come from the same env files as the app (root .env: POSTGRES_*).
 */
export async function createTestApp(): Promise<TestApp> {
  for (const file of ['apps/backend/.env', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional
    }
  }
  const secrets = {
    JWT_SECRET: 'integration-jwt-secret-at-least-32-characters',
    PASSWORD_PEPPER: 'integration-pepper-at-least-32-characters!',
  };
  const env = validateEnv({ ...process.env, ...secrets });
  const database = `myresume_test_${randomBytes(6).toString('hex')}`;
  const admin = new Client({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);

  Object.assign(process.env, {
    ...secrets,
    NODE_ENV: 'test',
    DATABASE_HOST: env.DATABASE_HOST,
    DATABASE_PORT: String(env.DATABASE_PORT),
    DATABASE_USER: env.DATABASE_USER,
    DATABASE_PASSWORD: env.DATABASE_PASSWORD,
    DATABASE_NAME: database,
    ADMIN_EMAIL: TEST_ADMIN.email,
    ADMIN_PASSWORD: TEST_ADMIN.password,
  });

  // Imported after the environment is set: ConfigModule reads it when the module is loaded.
  const { AppModule } = await import('../app/app.module');
  const { configureApp } = await import('../app/app.setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();

  const login = await request(app.getHttpServer()).post('/api/auth/login').send(TEST_ADMIN);
  if (login.status !== 200) throw new Error(`Test admin login failed: ${login.status}`);
  const dataSource = app.get(DataSource);

  return {
    app,
    dataSource,
    token: login.body.accessToken as string,
    truncateContent: async () => {
      await dataSource.query(`TRUNCATE ${CONTENT_TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
    },
    close: async () => {
      await app.close();
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** Small HTTP helper: writes are signed in by default, reads are anonymous unless asked. */
export function api(t: TestApp) {
  const server = () => t.app.getHttpServer();
  const auth = (req: request.Test, signedIn: boolean) =>
    signedIn ? req.set('Authorization', `Bearer ${t.token}`) : req;
  return {
    get: (url: string, signedIn = false) => auth(request(server()).get(url), signedIn),
    post: (url: string, body?: object, signedIn = true) =>
      auth(request(server()).post(url), signedIn).send(body),
    patch: (url: string, body?: object, signedIn = true) =>
      auth(request(server()).patch(url), signedIn).send(body),
    put: (url: string, body?: object, signedIn = true) =>
      auth(request(server()).put(url), signedIn).send(body),
    delete: (url: string, signedIn = true) => auth(request(server()).delete(url), signedIn),
  };
}

export type Api = ReturnType<typeof api>;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MISSING_ID = '00000000-0000-4000-8000-000000000000';
