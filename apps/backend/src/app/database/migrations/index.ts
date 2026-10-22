import type { MixedList } from 'typeorm';
import { CreateAdminUser1792663184655 } from './1792663184655-CreateAdminUser';

/**
 * Every migration of this folder, in order. The backend is bundled with webpack, so TypeORM cannot
 * load migrations with a glob: add each new migration class here (a test checks nothing is missing).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MIGRATIONS: MixedList<Function | string> = [CreateAdminUser1792663184655];
