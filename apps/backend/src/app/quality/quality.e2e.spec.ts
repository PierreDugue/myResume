import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { qualityReportFixture } from '../../testing/quality-report.fixture';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { AdminUser } from '../auth/entities/admin-user.entity';
import type { AppEnv } from '../config/env.validation';
import { SitePreferencesEntity } from '../preferences/entities/site-preferences.entity';
import { SkillEntity } from '../skills/entities/skill.entity';
import { QUALITY_REPORT_FILE } from './quality.constants';
import { QualityModule } from './quality.module';

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

describe('GET /api/quality', () => {
  let app: INestApplication;
  let dir: string;

  /** Starts the app with the global auth guards (AuthModule), no stored preferences, and the report at `file`. */
  async function start(file: string) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: () => env }),
        AuthModule,
        QualityModule,
      ],
    })
      .overrideProvider(getRepositoryToken(AdminUser))
      .useValue({
        findOneBy: vi.fn(),
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        save: vi.fn(),
      })
      // No preferences row: every page, Quality included, is enabled.
      .overrideProvider(getRepositoryToken(SitePreferencesEntity))
      .useValue({ find: vi.fn().mockResolvedValue([]) })
      // PreferencesModule imports SkillsModule; the page guard never reads skills.
      .overrideProvider(getRepositoryToken(SkillEntity))
      .useValue({ find: vi.fn().mockResolvedValue([]) })
      .overrideProvider(QUALITY_REPORT_FILE)
      .useValue(file)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'quality-e2e-'));
  });

  afterEach(async () => {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('returns 200 with the report, without a token', async () => {
    const file = join(dir, 'quality-report.json');
    await writeFile(file, JSON.stringify(qualityReportFixture));
    await start(file);

    const res = await request(app.getHttpServer()).get('/api/quality');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(qualityReportFixture);
  });

  it('returns 404 with the contract body when the build has no report', async () => {
    await start(join(dir, 'missing.json'));

    const res = await request(app.getHttpServer()).get('/api/quality');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'No quality report in this build',
      error: 'Not Found',
    });
  });

  it('returns 404 when the report file is invalid', async () => {
    const file = join(dir, 'quality-report.json');
    await writeFile(file, '{ nope');
    await start(file);

    await request(app.getHttpServer()).get('/api/quality').expect(404);
  });
});
