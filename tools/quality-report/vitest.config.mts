import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/quality-report',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'quality-report',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // test-results.json and (with --coverage) coverage-summary.json feed the Quality report (tools/quality-report).
    reporters: [
      'default',
      ['json', { outputFile: '../../coverage/quality-report/test-results.json' }],
    ],
    coverage: {
      reportsDirectory: '../../coverage/quality-report',
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary', 'html'],
      // Every source file counts, tested or not; tests and test fixtures don't.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/fixtures/**'],
    },
  },
});
