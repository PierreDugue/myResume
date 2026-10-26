import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { configureApp } from '../app.setup';
import type { AppEnv } from '../config/env.validation';
import { HealthModule } from '../health/health.module';
import { AuthModule } from './auth.module';
import { AdminUser } from './entities/admin-user.entity';
import { Public } from './public.decorator';

const SECRET = 'proxy-secret-that-is-at-least-32-characters';
const env: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 5432,
  DATABASE_USER: 'u',
  DATABASE_PASSWORD: 'p',
  DATABASE_NAME: 'd',
  DATABASE_SSL: false,
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars!',
  PASSWORD_PEPPER: 'test-pepper-that-is-at-least-32-chars!',
};

@Controller('probe')
class ProbeController {
  @Public()
  @Get('public')
  open() {
    return { ok: 'public' };
  }

  @Get('private')
  closed() {
    return { ok: 'private' };
  }
}

/** Fake of terminus' HealthCheckAttempt: chainable `.withTimeout()` and awaitable. */
function upAttempt() {
  const result: HealthIndicatorResult = { database: { status: 'up' } };
  const a = {
    withTimeout: () => a,
    then: (ok: (r: HealthIndicatorResult) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(ok, ko),
  };
  return a;
}

/**
 * On hosts where nginx reaches the backend through a public address (Render), nginx sends a shared
 * secret and the visitor's IP. With PROXY_SECRET set, the backend only answers requests that carry
 * the secret, and counts rate limits per X-Client-IP. Without it, nothing changes.
 */
describe('Trusted proxy (HTTP)', () => {
  let app: INestApplication;

  async function start(proxySecret?: string) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () => ({ ...env, ...(proxySecret && { PROXY_SECRET: proxySecret }) }),
        }),
        AuthModule,
        HealthModule,
      ],
      controllers: [ProbeController],
    })
      .overrideProvider(getRepositoryToken(AdminUser))
      .useValue({
        findOneBy: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        save: vi.fn(),
      })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: () => upAttempt() })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }

  afterEach(async () => {
    await app?.close();
    // ConfigModule copies validated values into process.env, where later apps would find them.
    delete process.env['PROXY_SECRET'];
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const login = () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'pierre@example.com', password: 'wrong password' });

  describe('with PROXY_SECRET set', () => {
    beforeEach(() => start(SECRET));

    it('rejects a request without the secret with 403, without revealing it', async () => {
      const res = await get('/api/probe/public');
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    it.each([
      ['a wrong secret of the same length', 'x'.repeat(SECRET.length)],
      ['a shorter secret', SECRET.slice(0, 10)],
      ['a longer secret', `${SECRET}x`],
    ])('rejects %s with 403', async (_case, secret) => {
      expect((await get('/api/probe/public').set('X-Proxy-Secret', secret)).status).toBe(403);
    });

    it('rejects login attempts without the secret too', async () => {
      expect((await login()).status).toBe(403);
    });

    it('answers a request that carries the secret', async () => {
      await get('/api/probe/public').set('X-Proxy-Secret', SECRET).expect(200, { ok: 'public' });
    });

    it('still requires the admin token on protected routes', async () => {
      expect((await get('/api/probe/private').set('X-Proxy-Secret', SECRET)).status).toBe(401);
    });

    it('lets the platform health check call GET /api/health without the secret', async () => {
      expect((await get('/api/health')).status).toBe(200);
    });

    it('counts login attempts per visitor IP sent by the proxy (X-Client-IP)', async () => {
      const from = (ip: string) => login().set('X-Proxy-Secret', SECRET).set('X-Client-IP', ip);
      for (let i = 0; i < 5; i++) {
        expect((await from('203.0.113.1')).status).toBe(401);
      }
      expect((await from('203.0.113.1')).status).toBe(429);
      expect((await from('2001:db8::2')).status).toBe(401);
    });

    it('falls back to the connection IP when X-Client-IP is missing or not an IP', async () => {
      const from = (ip?: string) => {
        const req = login().set('X-Proxy-Secret', SECRET);
        return ip === undefined ? req : req.set('X-Client-IP', ip);
      };
      for (let i = 0; i < 5; i++) {
        expect((await from(i % 2 ? 'not-an-ip' : undefined)).status).toBe(401);
      }
      expect((await from('another-garbage-value')).status).toBe(429);
    });
  });

  describe('without PROXY_SECRET (local dev, Docker Compose)', () => {
    beforeEach(() => start());

    it('answers requests without the secret', async () => {
      await get('/api/probe/public').expect(200, { ok: 'public' });
    });

    it('ignores X-Client-IP, which anyone could send', async () => {
      for (let i = 0; i < 5; i++) {
        expect((await login().set('X-Client-IP', `203.0.113.${i + 1}`)).status).toBe(401);
      }
      expect((await login().set('X-Client-IP', '203.0.113.99')).status).toBe(429);
    });
  });
});
