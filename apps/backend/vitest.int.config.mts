import { defineConfig } from 'vitest/config';

/**
 * Integration tests: the real app (all modules, migrations, guards) against a throwaway PostgreSQL
 * database per test file (see src/testing/test-app.ts). Needs `docker compose up -d postgres`.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/backend-int',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'backend-integration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
}));
