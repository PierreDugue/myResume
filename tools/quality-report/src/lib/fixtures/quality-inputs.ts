import type {
  AngularProjectJson,
  CoverageSummary,
  EsbuildMetafile,
  GithubJobs,
  GithubRun,
  NxGraphJson,
  QualityInputs,
  VitestJsonReport,
} from '../inputs.ts';

/** Small, hand-checkable pipeline outputs for the `assembleReport` and CLI specs. */

export function vitestReport(passed: number, failed = 0, pending = 0, todo = 0): VitestJsonReport {
  return {
    numPassedTests: passed,
    numFailedTests: failed,
    numPendingTests: pending,
    numTodoTests: todo,
  };
}

/** Each metric as `[covered, total]`. */
export function coverageSummary(
  lines: [number, number],
  statements: [number, number],
  functions: [number, number],
  branches: [number, number],
): CoverageSummary {
  const metric = ([covered, total]: [number, number]) => ({
    total,
    covered,
    pct: total === 0 ? ('Unknown' as const) : Math.round((covered / total) * 10000) / 100,
  });
  return {
    total: {
      lines: metric(lines),
      statements: metric(statements),
      functions: metric(functions),
      branches: metric(branches),
    },
  };
}

export const nxGraph: NxGraphJson = {
  graph: {
    nodes: {
      'query-parser': { type: 'lib', data: { root: 'libs/shared/query-parser' } },
      'frontend-e2e': { type: 'e2e', data: { root: 'apps/frontend-e2e' } },
      frontend: { type: 'app', data: { root: 'apps/frontend' } },
      'api-models': { type: 'lib', data: { root: 'libs/shared/api-models' } },
      backend: { type: 'app', data: { root: 'apps/backend' } },
    },
    dependencies: {
      'query-parser': [],
      'frontend-e2e': [{ source: 'frontend-e2e', target: 'frontend', type: 'implicit' }],
      frontend: [
        { source: 'frontend', target: 'query-parser', type: 'static' },
        { source: 'frontend', target: 'api-models', type: 'static' },
      ],
      'api-models': [],
      backend: [
        { source: 'backend', target: 'api-models', type: 'static' },
        { source: 'backend', target: 'npm:@nestjs/core', type: 'static' },
      ],
    },
  },
};

/** Initial: main 300 + chunk 200 + styles 50 = 550; lazy: 1000. */
export const frontendStats: EsbuildMetafile = {
  outputs: {
    'main-AAAAAAAA.js': {
      bytes: 300,
      entryPoint: 'apps/frontend/src/main.ts',
      imports: [
        { path: 'chunk-shared.js', kind: 'import-statement' },
        { path: 'chunk-page.js', kind: 'dynamic-import' },
      ],
    },
    'chunk-shared.js': { bytes: 200, imports: [] },
    'chunk-page.js': { bytes: 1000, entryPoint: 'apps/frontend/src/app/page.ts', imports: [] },
    'styles-AAAAAAAA.css': { bytes: 50, entryPoint: 'angular:styles/global:styles', imports: [] },
  },
};

export const frontendProject: AngularProjectJson = {
  targets: {
    build: {
      configurations: {
        production: {
          budgets: [{ type: 'initial', maximumWarning: '500kb', maximumError: '1mb' }],
        },
      },
    },
  },
};

export const ciRun: GithubRun = {
  head_sha: 'abc123abc123abc123abc123abc123abc123abc1',
  head_branch: 'main',
  html_url: 'https://github.com/octo/my-resume/actions/runs/7',
  run_started_at: '2026-10-31T10:00:00Z',
  repository: { html_url: 'https://github.com/octo/my-resume' },
};

export const ciJobs: GithubJobs = {
  jobs: [
    {
      name: 'Unit tests',
      status: 'completed',
      started_at: '2026-10-31T10:00:10Z',
      completed_at: '2026-10-31T10:02:10Z',
    },
    {
      name: 'Quality report',
      status: 'in_progress',
      started_at: '2026-10-31T10:03:00Z',
      completed_at: null,
    },
  ],
};

/** Every input present, listed in no particular order. */
export const fullInputs: QualityInputs = {
  nxGraph,
  projects: [
    {
      project: 'query-parser',
      suite: 'unit',
      testResults: vitestReport(10),
      coverageSummary: coverageSummary([99, 100], [99, 100], [99, 100], [99, 100]),
    },
    {
      project: 'backend',
      suite: 'integration',
      testResults: vitestReport(15),
      coverageSummary: coverageSummary([70, 100], [140, 200], [20, 40], [30, 60]),
    },
    // types only: no tests, 0 statements
    {
      project: 'api-models',
      suite: 'unit',
      testResults: vitestReport(0),
      coverageSummary: coverageSummary([0, 0], [0, 0], [0, 0], [0, 0]),
    },
    {
      project: 'frontend',
      suite: 'unit',
      testResults: vitestReport(30),
      coverageSummary: coverageSummary([9, 10], [9, 10], [9, 10], [9, 10]),
    },
    {
      project: 'backend',
      suite: 'unit',
      testResults: vitestReport(20, 1, 1, 1),
      coverageSummary: coverageSummary([80, 100], [160, 200], [30, 40], [45, 60]),
    },
    // an e2e project never has coverage
    {
      project: 'frontend-e2e',
      suite: 'unit',
      testResults: null,
      coverageSummary: coverageSummary([1, 2], [1, 2], [1, 2], [1, 2]),
    },
  ],
  frontendStats,
  frontendProject,
  ciRun,
  ciJobs,
};
