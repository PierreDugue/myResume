/**
 * Data source for the TypeORM CLI (`npx nx run backend:migration-generate --name=Foo`, ...).
 * Not used by the running app, which builds its options in app.module.ts.
 */
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { MIGRATIONS } from './migrations';
import { buildTypeOrmOptions } from './typeorm-options';

// Same env files as the app; variables already set in the shell win.
for (const file of ['apps/backend/.env', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional file
  }
}

const options = buildTypeOrmOptions(validateEnv(process.env)) as DataSourceOptions & {
  autoLoadEntities?: boolean;
};
delete options.autoLoadEntities;

export default new DataSource({
  ...options,
  migrationsRun: false,
  entities: [join(__dirname, '..', '**', '*.entity.ts')],
  migrations: MIGRATIONS,
} as DataSourceOptions);
