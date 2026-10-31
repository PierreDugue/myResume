import type { TestSuiteKind } from '@my-resume/api-models';

/**
 * The raw files the pipeline produces. Only the fields the tool reads are typed.
 */

/** Vitest's JSON reporter output (`test-results.json`). */
export interface VitestJsonReport {
  numPassedTests: number;
  numFailedTests: number;
  /** Skipped tests (`it.skip`). */
  numPendingTests: number;
  /** `it.todo`. */
  numTodoTests: number;
}

export interface CoverageSummaryMetric {
  total: number;
  covered: number;
  pct: number | 'Unknown';
}

/** istanbul's `json-summary` reporter output (`coverage-summary.json`); per-file entries are ignored. */
export interface CoverageSummary {
  total: {
    lines: CoverageSummaryMetric;
    statements: CoverageSummaryMetric;
    functions: CoverageSummaryMetric;
    branches: CoverageSummaryMetric;
  };
}

export interface EsbuildImport {
  path: string;
  kind: string;
  external?: boolean;
}

export interface EsbuildOutput {
  bytes: number;
  entryPoint?: string;
  imports: EsbuildImport[];
  /** Angular marks component stylesheets, which are inlined into the JS and never written as files. */
  'ng-component'?: boolean;
}

/** esbuild metafile, as written by `nx build frontend --stats-json` (`stats.json`). */
export interface EsbuildMetafile {
  outputs: Record<string, EsbuildOutput>;
}

export interface AngularBudget {
  type: string;
  baseline?: string;
  maximumWarning?: string;
  maximumError?: string;
}

/** The parts of `apps/frontend/project.json` the tool reads. */
export interface AngularProjectJson {
  targets?: {
    build?: {
      configurations?: {
        production?: { budgets?: AngularBudget[] };
      };
    };
  };
}

export interface NxGraphNode {
  type: string;
  data: { root: string };
}

export interface NxGraphDependency {
  source: string;
  target: string;
  type: string;
}

/** `npx nx graph --file=graph.json`. */
export interface NxGraphJson {
  graph: {
    nodes: Record<string, NxGraphNode>;
    dependencies: Record<string, NxGraphDependency[]>;
  };
}

/** `GET /repos/{owner}/{repo}/actions/runs/{run_id}`. */
export interface GithubRun {
  head_sha: string;
  head_branch: string | null;
  html_url: string;
  run_started_at: string;
  repository: { html_url: string };
}

export interface GithubJob {
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

/** `GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt}/jobs`. */
export interface GithubJobs {
  jobs: GithubJob[];
}

/** The test results and coverage summary of one project for one suite (`coverage/<project>/`, `coverage/integration/<project>/`). */
export interface ProjectReportFiles {
  project: string;
  suite: TestSuiteKind;
  testResults: VitestJsonReport | null;
  coverageSummary: CoverageSummary | null;
}

/** Everything `assembleReport` needs; every input except the graph may be missing. */
export interface QualityInputs {
  nxGraph: NxGraphJson;
  projects: ProjectReportFiles[];
  frontendStats: EsbuildMetafile | null;
  frontendProject: AngularProjectJson | null;
  ciRun: GithubRun | null;
  ciJobs: GithubJobs | null;
}
