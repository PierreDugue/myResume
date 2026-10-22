import type { MixedList } from 'typeorm';

/**
 * Every migration of this folder, in order. The backend is bundled with webpack, so TypeORM cannot
 * load migrations with a glob: add each new migration class here (a test checks nothing is missing).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MIGRATIONS: MixedList<Function | string> = [];
