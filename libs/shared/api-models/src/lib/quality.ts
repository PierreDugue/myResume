/** `GET /api/quality`: the build pipeline's report for the running version. */
export interface QualityReport {
  schemaVersion: 1;
  /** ISO timestamp: when CI assembled the report, just before this version was published and deployed (shown as "last deploy"). */
  generatedAt: string;
  /** null when the report was assembled outside GitHub Actions. */
  build: QualityBuild | null;
  tests: QualityTests;
  /** [] when coverage wasn't measured. */
  coverage: ProjectCoverage[];
  /** null when the frontend build stats weren't available. */
  bundle: BundleSize | null;
  /** null until the pipeline measures it. */
  lighthouse: LighthouseScores | null;
  projectGraph: ProjectGraph;
}

export interface QualityBuild {
  /** Full git sha. */
  commit: string;
  /** e.g. https://github.com/<owner>/<repo>/commit/<sha> */
  commitUrl: string;
  /** e.g. "main". */
  branch: string | null;
  /** The GitHub Actions run. */
  runUrl: string;
  /** ISO timestamp: when the run started. */
  startedAt: string;
  /** From the run's start until the report was assembled (the checks run in parallel). */
  durationSeconds: number;
  /** Completed jobs of the run, in start order. */
  jobs: PipelineJob[];
}

export interface PipelineJob {
  /** e.g. "Unit tests". */
  name: string;
  durationSeconds: number;
}

export type TestSuiteKind = 'unit' | 'integration' | 'e2e';

export interface TestCounts {
  /** passed + failed + skipped. */
  total: number;
  passed: number;
  failed: number;
  /** Skipped and todo tests. */
  skipped: number;
  /** passed / (passed + failed) × 100, 1 decimal; null when no test ran. */
  passRate: number | null;
}

export interface SuiteTestResult extends TestCounts {
  suite: TestSuiteKind;
}

export interface ProjectTestResult extends TestCounts {
  /** Nx project name, e.g. "backend". */
  project: string;
  suite: TestSuiteKind;
}

export interface QualityTests {
  /** Every suite together. */
  total: TestCounts;
  /** Only the suites that ran, in the order unit, integration, e2e. */
  suites: SuiteTestResult[];
  /** By suite (same order), then project name; projects with no tests are left out. */
  projects: ProjectTestResult[];
}

/** Percentages 0..100, 1 decimal. */
export interface CoverageMetrics {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

/**
 * Order: apps, then libraries; by project name; unit before integration.
 * Projects without runtime code (0 statements, e.g. api-models) are left out.
 * Every source file of a project counts, tested or not.
 */
export interface ProjectCoverage {
  /** Nx project name. */
  project: string;
  kind: 'app' | 'lib';
  /** The tests that measured it: "unit", or "integration" for the backend's integration tests. */
  suite: TestSuiteKind;
  metrics: CoverageMetrics;
}

export interface BundleSize {
  /** Raw size of the JS and CSS loaded on the first visit (what Angular's "initial" budget measures). */
  initialBytes: number;
  /** Raw size of all the lazy-loaded chunks together. */
  lazyBytes: number;
  /** The "initial" warning budget in apps/frontend/project.json; 1 kB = 1000 bytes, as Angular counts. */
  budgetWarningBytes: number | null;
  /** The "initial" error budget in apps/frontend/project.json. */
  budgetErrorBytes: number | null;
}

/** Lighthouse category scores, 0..100. */
export interface LighthouseScores {
  /** The page measured. */
  url: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export type ProjectGraphNodeKind = 'app' | 'lib' | 'e2e';

export interface ProjectGraphNode {
  /** Nx project name. */
  name: string;
  kind: ProjectGraphNodeKind;
  /** e.g. "libs/shared/api-models". */
  root: string;
}

/** `source` depends on `target` (imports it, or an implicit dependency such as e2e → app). */
export interface ProjectGraphEdge {
  source: string;
  target: string;
}

export interface ProjectGraph {
  /** Apps, e2e projects, then libraries; by name within each. */
  nodes: ProjectGraphNode[];
  /** No duplicates, by source then target. */
  edges: ProjectGraphEdge[];
}
