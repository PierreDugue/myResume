import type {
  ProjectCoverage,
  ProjectGraphNodeKind,
  ProjectTestResult,
  QualityReport,
  QualityTests,
  SuiteTestResult,
  TestSuiteKind,
} from '@my-resume/api-models';
import { buildFromGithub } from './build.ts';
import { bundleSizesFromMetafile, initialBudgetFromProject } from './bundle.ts';
import { coverageFromSummary } from './coverage.ts';
import type { ProjectReportFiles, QualityInputs } from './inputs.ts';
import { compareStrings } from './numbers.ts';
import { projectGraphFromNx } from './project-graph.ts';
import { sumTestCounts, testCountsFromVitest } from './test-counts.ts';

const SUITE_ORDER: readonly TestSuiteKind[] = ['unit', 'integration', 'e2e'];

function bySuite(a: TestSuiteKind, b: TestSuiteKind): number {
  return SUITE_ORDER.indexOf(a) - SUITE_ORDER.indexOf(b);
}

function assembleTests(projects: ProjectReportFiles[]): QualityTests {
  const results: ProjectTestResult[] = projects
    .flatMap(({ project, suite, testResults }) =>
      testResults ? [{ project, suite, ...testCountsFromVitest(testResults) }] : [],
    )
    .filter((result) => result.total > 0)
    .sort((a, b) => bySuite(a.suite, b.suite) || compareStrings(a.project, b.project));

  const suites: SuiteTestResult[] = SUITE_ORDER.flatMap((suite) => {
    const ofSuite = results.filter((result) => result.suite === suite);
    return ofSuite.length > 0 ? [{ suite, ...sumTestCounts(ofSuite) }] : [];
  });

  return { total: sumTestCounts(results), suites, projects: results };
}

function assembleCoverage(
  projects: ProjectReportFiles[],
  kinds: Map<string, ProjectGraphNodeKind>,
): ProjectCoverage[] {
  const coverage: ProjectCoverage[] = [];
  for (const { project, suite, coverageSummary } of projects) {
    const kind = kinds.get(project);
    const metrics = coverageSummary && coverageFromSummary(coverageSummary);
    // e2e projects never have coverage, and reports of projects outside the graph are stale.
    if (metrics && (kind === 'app' || kind === 'lib')) {
      coverage.push({ project, kind, suite, metrics });
    }
  }
  const kindOrder = (kind: 'app' | 'lib') => (kind === 'app' ? 0 : 1);
  return coverage.sort(
    (a, b) =>
      kindOrder(a.kind) - kindOrder(b.kind) ||
      compareStrings(a.project, b.project) ||
      bySuite(a.suite, b.suite),
  );
}

/** Builds the Quality report (`GET /api/quality`) from the pipeline's raw outputs. */
export function assembleReport(inputs: QualityInputs, now: Date): QualityReport {
  const projectGraph = projectGraphFromNx(inputs.nxGraph);
  const kinds = new Map(projectGraph.nodes.map((node) => [node.name, node.kind]));
  const inGraph = inputs.projects.filter((files) => kinds.has(files.project));

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    build: inputs.ciRun ? buildFromGithub(inputs.ciRun, inputs.ciJobs, now) : null,
    tests: assembleTests(inGraph),
    coverage: assembleCoverage(inGraph, kinds),
    bundle: inputs.frontendStats
      ? {
          ...bundleSizesFromMetafile(inputs.frontendStats),
          ...initialBudgetFromProject(inputs.frontendProject),
        }
      : null,
    lighthouse: null,
    projectGraph,
  };
}
