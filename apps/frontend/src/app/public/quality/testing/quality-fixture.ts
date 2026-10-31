import type {
  ProjectCoverage,
  ProjectTestResult,
  QualityReport,
  TestCounts,
} from '@my-resume/api-models';

function counts(passed: number, failed: number, skipped: number): TestCounts {
  const ran = passed + failed;
  return {
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    passRate: ran === 0 ? null : Math.round((passed / ran) * 1000) / 10,
  };
}

function coverage(
  project: string,
  kind: 'app' | 'lib',
  suite: 'unit' | 'integration',
  lines: number,
  statements: number,
  functions: number,
  branches: number,
): ProjectCoverage {
  return { project, kind, suite, metrics: { lines, statements, functions, branches } };
}

const projects: ProjectTestResult[] = [
  { project: 'backend', suite: 'unit', ...counts(250, 0, 0) },
  { project: 'frontend', suite: 'unit', ...counts(326, 0, 4) },
  { project: 'query-parser', suite: 'unit', ...counts(40, 0, 0) },
  { project: 'resume-metrics', suite: 'unit', ...counts(20, 0, 0) },
  { project: 'backend', suite: 'integration', ...counts(58, 2, 0) },
];

/**
 * A full report, as CI produces it today: no Lighthouse yet and no e2e suite. Hand-checkable:
 * 700 tests (640 unit + 60 integration), 694 passed, 2 failed, 4 skipped.
 */
export function qualityFixture(): QualityReport {
  return {
    schemaVersion: 1,
    generatedAt: '2026-10-31T14:02:11Z',
    build: {
      commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      commitUrl: 'https://github.com/PierreDugue/myResume/commit/a1b2c3d4e5f6',
      branch: 'main',
      runUrl: 'https://github.com/PierreDugue/myResume/actions/runs/123456',
      startedAt: '2026-10-31T13:56:00Z',
      durationSeconds: 372,
      jobs: [
        { name: 'Lint', durationSeconds: 95 },
        { name: 'Unit tests', durationSeconds: 210 },
        { name: 'Integration tests', durationSeconds: 128 },
        { name: 'Build', durationSeconds: 150 },
      ],
    },
    tests: {
      total: counts(694, 2, 4),
      suites: [
        { suite: 'unit', ...counts(636, 0, 4) },
        { suite: 'integration', ...counts(58, 2, 0) },
      ],
      projects,
    },
    coverage: [
      coverage('backend', 'app', 'unit', 91.2, 90.8, 88, 80.5),
      coverage('backend', 'app', 'integration', 62.4, 61.9, 55.2, 40.1),
      coverage('frontend', 'app', 'unit', 87.3, 86.9, 80.4, 75.6),
      coverage('query-parser', 'lib', 'unit', 96.5, 96.1, 100, 92.3),
      coverage('resume-metrics', 'lib', 'unit', 98.1, 97.8, 100, 94),
    ],
    bundle: {
      initialBytes: 412340,
      lazyBytes: 1204500,
      budgetWarningBytes: 500000,
      budgetErrorBytes: 1000000,
    },
    lighthouse: null,
    projectGraph: {
      nodes: [
        { name: 'backend', kind: 'app', root: 'apps/backend' },
        { name: 'frontend', kind: 'app', root: 'apps/frontend' },
        { name: 'frontend-e2e', kind: 'e2e', root: 'apps/frontend-e2e' },
        { name: 'api-models', kind: 'lib', root: 'libs/shared/api-models' },
        { name: 'query-parser', kind: 'lib', root: 'libs/shared/query-parser' },
        { name: 'resume-metrics', kind: 'lib', root: 'libs/shared/resume-metrics' },
      ],
      edges: [
        { source: 'backend', target: 'api-models' },
        { source: 'backend', target: 'query-parser' },
        { source: 'backend', target: 'resume-metrics' },
        { source: 'frontend', target: 'api-models' },
        { source: 'frontend', target: 'query-parser' },
        { source: 'frontend', target: 'resume-metrics' },
        { source: 'frontend-e2e', target: 'frontend' },
        { source: 'resume-metrics', target: 'api-models' },
      ],
    },
  };
}

/** A partial report: assembled outside GitHub Actions, nothing but test counts and the graph. */
export function partialQualityFixture(): QualityReport {
  return {
    ...qualityFixture(),
    build: null,
    tests: {
      total: counts(20, 0, 0),
      suites: [{ suite: 'unit', ...counts(20, 0, 0) }],
      projects: [{ project: 'frontend', suite: 'unit', ...counts(20, 0, 0) }],
    },
    coverage: [],
    bundle: null,
    lighthouse: null,
    projectGraph: {
      nodes: [{ name: 'frontend', kind: 'app', root: 'apps/frontend' }],
      edges: [],
    },
  };
}

/** A report where Lighthouse was measured. */
export function lighthouseQualityFixture(): QualityReport {
  return {
    ...qualityFixture(),
    lighthouse: {
      url: 'https://example.com/',
      performance: 96,
      accessibility: 100,
      bestPractices: 75,
      seo: 42,
    },
  };
}
