import { INestApplication } from '@nestjs/common';
import { HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import type { HealthResponse } from '@my-resume/api-models';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { HealthModule } from './health.module';

describe('GET /api/health', () => {
  let app: INestApplication;
  const withTimeout = vi.fn();
  const pingCheck = vi.fn();

  /** Fake of terminus' HealthCheckAttempt: chainable `.withTimeout()` and awaitable. */
  function attempt(result: HealthIndicatorResult) {
    const a = {
      withTimeout: withTimeout.mockImplementation(() => a),
      then: (ok: (r: HealthIndicatorResult) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(ok, ko),
    };
    return a;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    pingCheck.mockReset();
    withTimeout.mockReset();
  });

  it('returns 200 and status "ok" when the database is up', async () => {
    pingCheck.mockReturnValue(attempt({ database: { status: 'up' } }));

    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    const body = res.body as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.details).toEqual({ database: { status: 'up' } });
    expect(body.info).toEqual({ database: { status: 'up' } });
  });

  it('returns 503 and status "error" when the database is down', async () => {
    pingCheck.mockReturnValue(attempt({ database: { status: 'down', message: 'timeout' } }));

    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    const body = res.body as HealthResponse;
    expect(body.status).toBe('error');
    expect(body.error).toEqual({ database: { status: 'down', message: 'timeout' } });
    expect(body.details['database']?.status).toBe('down');
  });

  it('pings the database under the "database" key with a short timeout', async () => {
    pingCheck.mockReturnValue(attempt({ database: { status: 'up' } }));

    await request(app.getHttpServer()).get('/api/health');

    expect(pingCheck).toHaveBeenCalledWith('database');
    expect(withTimeout).toHaveBeenCalledWith(1500);
  });

  it('is public (no auth required)', async () => {
    pingCheck.mockReturnValue(attempt({ database: { status: 'up' } }));
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
