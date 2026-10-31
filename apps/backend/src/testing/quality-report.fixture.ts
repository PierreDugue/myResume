import type { QualityReport } from '@my-resume/api-models';

/** A minimal, valid quality report for tests. */
export const qualityReportFixture: QualityReport = {
  schemaVersion: 1,
  generatedAt: '2026-05-01T10:00:00.000Z',
  build: null,
  tests: {
    total: { total: 3, passed: 2, failed: 0, skipped: 1, passRate: 100 },
    suites: [{ suite: 'unit', total: 3, passed: 2, failed: 0, skipped: 1, passRate: 100 }],
    projects: [
      {
        suite: 'unit',
        project: 'backend',
        total: 3,
        passed: 2,
        failed: 0,
        skipped: 1,
        passRate: 100,
      },
    ],
  },
  coverage: [],
  bundle: null,
  lighthouse: null,
  projectGraph: { nodes: [], edges: [] },
};
