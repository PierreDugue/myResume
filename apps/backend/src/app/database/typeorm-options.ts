import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as pg from 'pg';
import type { AppEnv } from '../config/env.validation';
import { MIGRATIONS } from './migrations';

/** TypeORM options of the running app. Schema changes only happen through migrations. */
export function buildTypeOrmOptions(env: AppEnv): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    // Explicit driver: TypeORM would load "pg" dynamically, which the production bundle would miss.
    driver: pg,
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    // uuid columns default to gen_random_uuid() (built into PostgreSQL 13+), no uuid-ossp needed.
    uuidExtension: 'pgcrypto',
    autoLoadEntities: true,
    synchronize: false,
    migrations: MIGRATIONS,
    migrationsRun: true,
    logging:
      env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error', 'migration'],
  };
}
