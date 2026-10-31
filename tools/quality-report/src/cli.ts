/**
 * Assembles the Quality report (`GET /api/quality`) from the pipeline's raw outputs.
 *
 *   node tools/quality-report/src/cli.ts --nx-graph dist/quality-report/nx-graph.json [options]
 *   npx nx run quality-report:assemble --nx-graph dist/quality-report/nx-graph.json [options]
 *
 * Every input except the project graph is optional: a missing file leaves its section empty or null.
 * Runs with Node's built-in type stripping (no build step).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { QualityReport, TestSuiteKind } from '@my-resume/api-models';
import { assembleReport } from './lib/assemble.ts';
import type {
  AngularProjectJson,
  CoverageSummary,
  EsbuildMetafile,
  GithubJobs,
  GithubRun,
  NxGraphJson,
  ProjectReportFiles,
  VitestJsonReport,
} from './lib/inputs.ts';

const USAGE = `Options:
  --nx-graph <file>          required: output of \`npx nx graph --file=<file>\`
  --coverage-dir <dir>       test results and coverage: <dir>/<project>/ (unit), <dir>/integration/<project>/ (default: coverage)
  --frontend-stats <file>    esbuild stats of \`nx build frontend --stats-json\` (default: dist/apps/frontend/stats.json)
  --frontend-project <file>  for the "initial" budget (default: apps/frontend/project.json)
  --ci-run <file>            GitHub Actions run JSON (gh api repos/{owner}/{repo}/actions/runs/{id})
  --ci-jobs <file>           its jobs JSON (gh api .../runs/{id}/attempts/{attempt}/jobs)
  --out <file>               (default: dist/quality-report/quality-report.json)`;

/** The suites read from the coverage directory, and their sub-directory. */
const SUITE_DIRS: readonly { suite: TestSuiteKind; dir: string }[] = [
  { suite: 'unit', dir: '' },
  { suite: 'integration', dir: 'integration' },
];

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function readOptionalJson<T>(file: string | undefined): T | null {
  return file !== undefined && existsSync(file) ? readJson<T>(file) : null;
}

function readProjectReports(coverageDir: string, projects: string[]): ProjectReportFiles[] {
  return SUITE_DIRS.flatMap(({ suite, dir }) =>
    projects.map((project) => {
      const projectDir = join(coverageDir, dir, project);
      return {
        project,
        suite,
        testResults: readOptionalJson<VitestJsonReport>(join(projectDir, 'test-results.json')),
        coverageSummary: readOptionalJson<CoverageSummary>(
          join(projectDir, 'coverage-summary.json'),
        ),
      };
    }),
  );
}

/** Reads the inputs named by `args`, writes the report to `--out` and returns it. */
export function runCli(args: string[], now: Date): QualityReport {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      'nx-graph': { type: 'string' },
      'coverage-dir': { type: 'string', default: 'coverage' },
      'frontend-stats': { type: 'string', default: 'dist/apps/frontend/stats.json' },
      'frontend-project': { type: 'string', default: 'apps/frontend/project.json' },
      'ci-run': { type: 'string' },
      'ci-jobs': { type: 'string' },
      out: { type: 'string', default: 'dist/quality-report/quality-report.json' },
    },
  });
  if (values['nx-graph'] === undefined) {
    throw new Error(`--nx-graph is required.\n${USAGE}`);
  }

  const nxGraph = readJson<NxGraphJson>(values['nx-graph']);
  const report = assembleReport(
    {
      nxGraph,
      projects: readProjectReports(values['coverage-dir'], Object.keys(nxGraph.graph.nodes)),
      frontendStats: readOptionalJson<EsbuildMetafile>(values['frontend-stats']),
      frontendProject: readOptionalJson<AngularProjectJson>(values['frontend-project']),
      ciRun: readOptionalJson<GithubRun>(values['ci-run']),
      ciJobs: readOptionalJson<GithubJobs>(values['ci-jobs']),
    },
    now,
  );

  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const report = runCli(args, new Date());
    const { tests, coverage, bundle, build } = report;
    console.log(
      `Quality report written: ${tests.total.total} tests, ${coverage.length} coverage entries, ` +
        `bundle ${bundle ? 'measured' : 'not measured'}, build ${build ? 'from GitHub Actions' : 'not measured'}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
