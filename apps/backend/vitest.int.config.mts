import { defineConfig } from 'vitest/config';

/**
 * Integration tests: the real app (all modules, migrations, guards) against a throwaway PostgreSQL
 * database per test file (see src/testing/test-app.ts). Needs `docker compose up -d postgres`.
 */
export default defineConfig({
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
    // test-results.json and (with --coverage) coverage-summary.json feed the Quality report (tools/quality-report).
    reporters: [
      'default',
      ['json', { outputFile: '../../coverage/integration/backend/test-results.json' }],
    ],
    coverage: {
      reportsDirectory: '../../coverage/integration/backend',
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary', 'html'],
      // Every source file counts, tested or not; tests and test helpers don't.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**'],
    },
  },
});
