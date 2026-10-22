import type { MixedList } from 'typeorm';
import { CreateAdminUser1792663184655 } from './1792663184655-CreateAdminUser';
import { CreateContent1792669952176 } from './1792669952176-CreateContent';
import { SeedResume1792669998403 } from './1792669998403-SeedResume';

/**
 * Every migration of this folder, in order. The backend is bundled with webpack, so TypeORM cannot
 * load migrations with a glob: add each new migration class here (a test checks nothing is missing).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MIGRATIONS: MixedList<Function | string> = [
  CreateAdminUser1792663184655,
  CreateContent1792669952176,
  SeedResume1792669998403,
];
