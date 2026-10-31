import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/api-models',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'api-models',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    // test-results.json and (with --coverage) coverage-summary.json feed the Quality report (tools/quality-report).
    reporters: [
      'default',
      ['json', { outputFile: '../../../coverage/api-models/test-results.json' }],
    ],
    coverage: {
      reportsDirectory: '../../../coverage/api-models',
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary', 'html'],
      // Every source file counts, tested or not; tests and test fixtures don't.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/fixtures.ts'],
    },
  },
});
