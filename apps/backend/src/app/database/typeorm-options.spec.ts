import * as pg from 'pg';
import { AppEnv } from '../config/env.validation';
import { MIGRATIONS } from './migrations';
import { buildTypeOrmOptions } from './typeorm-options';

const env: AppEnv = {
  NODE_ENV: 'production',
  PORT: 3000,
  DATABASE_HOST: 'postgres',
  DATABASE_PORT: 5432,
  DATABASE_USER: 'app',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'resume',
  JWT_SECRET: 'x'.repeat(32),
  PASSWORD_PEPPER: 'p'.repeat(32),
};

describe('buildTypeOrmOptions', () => {
  it('connects to PostgreSQL with the configured credentials', () => {
    expect(buildTypeOrmOptions(env)).toMatchObject({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      username: 'app',
      password: 'secret',
      database: 'resume',
    });
  });

  it('never synchronizes the schema automatically; schema changes go through migrations', () => {
    expect(buildTypeOrmOptions(env).synchronize).toBe(false);
    expect(buildTypeOrmOptions({ ...env, NODE_ENV: 'development' }).synchronize).toBe(false);
  });

  it('runs the registered migrations on startup', () => {
    const options = buildTypeOrmOptions(env);
    expect(options.migrationsRun).toBe(true);
    expect(options.migrations).toEqual(MIGRATIONS);
  });

  it('registers entities through their Nest modules (autoLoadEntities)', () => {
    expect(buildTypeOrmOptions(env).autoLoadEntities).toBe(true);
  });

  it('passes the pg driver explicitly, so the production bundle declares and ships it', () => {
    // TypeORM otherwise loads "pg" dynamically, and webpack's generated package.json omits it.
    expect(buildTypeOrmOptions(env)).toMatchObject({ driver: pg });
  });

  it('generates uuids with the built-in gen_random_uuid() (pgcrypto), not the uuid-ossp extension', () => {
    expect(buildTypeOrmOptions(env)).toMatchObject({ uuidExtension: 'pgcrypto' });
  });
});
