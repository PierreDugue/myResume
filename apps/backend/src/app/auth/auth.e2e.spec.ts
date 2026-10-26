import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AuthUser, LoginResponse } from '@my-resume/api-models';
import request from 'supertest';
import { configureApp } from '../app.setup';
import type { AppEnv } from '../config/env.validation';
import { AuthModule } from './auth.module';
import { AdminUser } from './entities/admin-user.entity';
import { hashPassword } from './password';
import { Public } from './public.decorator';

// Logins hash and compare passwords many times. bcrypt cost 12 (production) takes ~250 ms per
// hash, enough to push these tests past Vitest's 5 s timeout on CI runners. The minimum cost (4)
// keeps the same behavior in ~1 ms. password.spec.ts covers the production cost.
vi.mock('bcryptjs', async (importOriginal) => {
  const bcrypt = await importOriginal<typeof import('bcryptjs')>();
  return { ...bcrypt, hash: (password: string) => bcrypt.hash(password, 4) };
});

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
const PASSWORD = 'correct horse battery staple';

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

  @Post('private')
  write() {
    return { ok: 'written' };
  }
}

describe('Auth (HTTP)', () => {
  let app: INestApplication;
  let admin: AdminUser;
  const repo = {
    findOneBy: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    save: vi.fn(),
  };

  beforeAll(async () => {
    admin = Object.assign(new AdminUser(), {
      id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
      email: 'pierre@example.com',
      passwordHash: await hashPassword(PASSWORD, env.PASSWORD_PEPPER),
    });
  });

  /** A fresh app per test: rate-limit counters start at zero. */
  beforeEach(async () => {
    repo.findOneBy.mockReset();
    repo.findOneBy.mockImplementation(async (where: Partial<AdminUser>) =>
      (where.email && where.email === admin.email) || (where.id && where.id === admin.id)
        ? admin
        : null,
    );
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: () => env }),
        AuthModule,
      ],
      controllers: [ProbeController],
    })
      .overrideProvider(getRepositoryToken(AdminUser))
      .useValue(repo)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  const login = (body: object) => request(app.getHttpServer()).post('/api/auth/login').send(body);
  const tokenFor = async () =>
    ((await login({ email: admin.email, password: PASSWORD })).body as LoginResponse).accessToken;

  describe('POST /api/auth/login', () => {
    it('returns 200 with a token valid for 24 h', async () => {
      const res = await login({ email: 'pierre@example.com', password: PASSWORD });
      expect(res.status).toBe(200);
      const body = res.body as LoginResponse;
      expect(body.expiresIn).toBe(86400);
      expect(typeof body.accessToken).toBe('string');
      expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresIn']);
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      const res = await login({ email: '  PIERRE@example.com ', password: PASSWORD });
      expect(res.status).toBe(200);
    });

    it('returns 401 "Invalid credentials" for a wrong password', async () => {
      const res = await login({ email: 'pierre@example.com', password: 'wrong password' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns the same 401 for an unknown email (no account enumeration)', async () => {
      const res = await login({ email: 'nobody@example.com', password: PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it.each([
      ['an invalid email', { email: 'not-an-email', password: PASSWORD }],
      ['a missing password', { email: 'pierre@example.com' }],
      ['an empty password', { email: 'pierre@example.com', password: '' }],
      [
        'a password over 200 characters',
        { email: 'pierre@example.com', password: 'x'.repeat(201) },
      ],
      ['an unknown field', { email: 'pierre@example.com', password: PASSWORD, admin: true }],
    ])('returns 400 for %s', async (_case, body) => {
      expect((await login(body)).status).toBe(400);
    });

    it('returns 429 after 5 attempts in a minute from the same IP', async () => {
      for (let i = 0; i < 5; i++) {
        expect((await login({ email: 'pierre@example.com', password: 'wrong' })).status).toBe(401);
      }
      const res = await login({ email: 'pierre@example.com', password: PASSWORD });
      expect(res.status).toBe(429);
    });

    it('counts attempts per client IP when behind the proxy (X-Forwarded-For)', async () => {
      for (let i = 0; i < 5; i++) {
        await login({ email: 'pierre@example.com', password: 'wrong' }).set(
          'X-Forwarded-For',
          '203.0.113.1',
        );
      }
      const otherVisitor = await login({ email: 'pierre@example.com', password: PASSWORD }).set(
        'X-Forwarded-For',
        '203.0.113.2',
      );
      expect(otherVisitor.status).toBe(200);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the signed-in admin without its password hash', async () => {
      const token = await tokenFor();
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body as AuthUser).toEqual({ id: admin.id, email: admin.email });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('returns 401 without a token', async () => {
      expect((await request(app.getHttpServer()).get('/api/auth/me')).status).toBe(401);
    });

    it('returns 401 when the admin account no longer exists', async () => {
      const token = await tokenFor();
      repo.findOneBy.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe('global protection', () => {
    const jwt = new JwtService();
    const payload = { sub: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'pierre@example.com' };

    it('lets anyone call a @Public() route', async () => {
      await request(app.getHttpServer()).get('/api/probe/public').expect(200, { ok: 'public' });
    });

    it('protects every other route by default (GET and POST)', async () => {
      expect((await request(app.getHttpServer()).get('/api/probe/private')).status).toBe(401);
      expect((await request(app.getHttpServer()).post('/api/probe/private')).status).toBe(401);
    });

    it('accepts a valid token', async () => {
      const token = await tokenFor();
      await request(app.getHttpServer())
        .post('/api/probe/private')
        .set('Authorization', `Bearer ${token}`)
        .expect(201, { ok: 'written' });
    });

    it.each([
      ['garbage', () => 'not.a.jwt'],
      [
        'a token signed with another secret',
        () => jwt.sign(payload, { secret: 'another-secret-another-secret-12345' }),
      ],
      [
        'an expired token',
        () =>
          jwt.sign(
            { ...payload, exp: Math.floor(Date.now() / 1000) - 60 },
            { secret: env.JWT_SECRET },
          ),
      ],
      [
        'an unsigned token (alg "none")',
        () => `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`,
      ],
      ['a token without the "Bearer" scheme', () => null],
    ])('rejects %s with 401', async (_case, makeToken) => {
      const token = makeToken();
      const header = token === null ? await tokenFor() : `Bearer ${token}`;
      const res = await request(app.getHttpServer())
        .get('/api/probe/private')
        .set('Authorization', header);
      expect(res.status).toBe(401);
    });
  });
});

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
