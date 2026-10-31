import type {
  ProjectCoverage,
  ProjectGraph,
  ProjectGraphNodeKind,
  QualityBuild,
  QualityReport,
  QualityTests,
  TestCounts,
  TestSuiteKind,
} from '@my-resume/api-models';
import { formatBytes } from '../../shared/format/bytes';
import { formatDuration } from '../../shared/format/duration';
import { formatTimestamp } from '../../shared/format/timestamp';
import type { GaugeGroup } from '../../shared/panels/bar-gauge/bar-gauge';

/** Pure mappers from the report to what the Quality panels display. */

const NONE = '–';

export interface StatView {
  label: string;
  display: string;
  hint: string | null;
}
export interface TestRow {
  name: string;
  /** null: the suite did not run. */
  counts: TestCounts | null;
}
export interface CoverageRow {
  name: string;
  kind: string;
  lines: string;
  statements: string;
  functions: string;
  branches: string;
}
export interface GraphRow {
  name: string;
  kind: string;
  root: string;
  dependsOn: string;
}

const SUITES: { suite: TestSuiteKind; name: string }[] = [
  { suite: 'unit', name: 'Unit' },
  { suite: 'integration', name: 'Integration' },
  { suite: 'e2e', name: 'End-to-end' },
];

const NODE_KIND_NAMES: Record<ProjectGraphNodeKind, string> = {
  app: 'App',
  e2e: 'End-to-end',
  lib: 'Library',
};

export function formatPassRate(rate: number | null): string {
  return rate === null ? NONE : `${rate.toFixed(1)} %`;
}

function percent(value: number): string {
  return `${value.toFixed(1)} %`;
}

export function qualityStats(report: QualityReport): StatView[] {
  const { total } = report.tests;
  const problems = [
    total.failed > 0 ? `${total.failed} failed` : '',
    total.skipped > 0 ? `${total.skipped} skipped` : '',
  ].filter(Boolean);
  const { bundle, build } = report;
  return [
    {
      label: 'Tests',
      display: String(total.total),
      hint: problems.length > 0 ? problems.join(', ') : 'all passing',
    },
    { label: 'Pass rate', display: formatPassRate(total.passRate), hint: 'skipped tests excluded' },
    {
      label: 'Initial bundle',
      display: bundle ? formatBytes(bundle.initialBytes) : NONE,
      hint: !bundle
        ? 'not measured yet'
        : bundle.budgetWarningBytes === null
          ? null
          : `of ${formatBytes(bundle.budgetWarningBytes)} budget`,
    },
    {
      label: 'CI duration',
      display: build ? formatDuration(build.durationSeconds) : NONE,
      hint: build ? 'checks run in parallel' : 'not built in CI',
    },
    {
      label: 'Last deploy',
      display: formatTimestamp(report.generatedAt),
      hint: build ? `commit ${build.commit.slice(0, 7)}` : null,
    },
  ];
}

/** Always unit, integration and e2e: a suite that did not run has `counts: null`. */
export function suiteRows(tests: QualityTests): TestRow[] {
  return SUITES.map(({ suite, name }) => ({
    name,
    counts: tests.suites.find((s) => s.suite === suite) ?? null,
  }));
}

export function projectRows(tests: QualityTests): TestRow[] {
  return tests.projects.map((p) => ({ name: `${p.project} · ${p.suite}`, counts: p }));
}

function coverageName(c: ProjectCoverage): string {
  return c.suite === 'unit' ? c.project : `${c.project} · ${c.suite}`;
}

/** Bars of the lines percentage (0..100), grouped as apps and libraries. */
export function coverageGroups(coverage: ProjectCoverage[]): GaugeGroup[] {
  const group = (label: string, kind: ProjectCoverage['kind']): GaugeGroup => ({
    label,
    items: coverage
      .filter((c) => c.kind === kind)
      .map((c) => ({
        label: coverageName(c),
        value: c.metrics.lines,
        display: percent(c.metrics.lines),
        note: `stmts ${c.metrics.statements.toFixed(1)} · funcs ${c.metrics.functions.toFixed(1)} · branches ${c.metrics.branches.toFixed(1)}`,
      })),
  });
  return [group('Apps', 'app'), group('Libraries', 'lib')].filter((g) => g.items.length > 0);
}

/** The table alternative: all four metrics. */
export function coverageRows(coverage: ProjectCoverage[]): CoverageRow[] {
  return coverage.map((c) => ({
    name: coverageName(c),
    kind: c.kind === 'app' ? 'App' : 'Library',
    lines: percent(c.metrics.lines),
    statements: percent(c.metrics.statements),
    functions: percent(c.metrics.functions),
    branches: percent(c.metrics.branches),
  }));
}

export function jobGroups(build: QualityBuild | null): GaugeGroup[] {
  if (!build || build.jobs.length === 0) return [];
  return [
    {
      label: 'Jobs',
      items: build.jobs.map((j) => ({
        label: j.name,
        value: j.durationSeconds,
        display: formatDuration(j.durationSeconds),
        note: null,
      })),
    },
  ];
}

export function graphRows(graph: ProjectGraph): GraphRow[] {
  return graph.nodes.map((node) => {
    const targets = graph.edges.filter((e) => e.source === node.name).map((e) => e.target);
    return {
      name: node.name,
      kind: NODE_KIND_NAMES[node.kind],
      root: node.root,
      dependsOn: targets.length > 0 ? targets.join(', ') : NONE,
    };
  });
}

/** Lighthouse's own bands: 0-49 poor, 50-89 needs improvement, 90-100 good. */
export function lighthouseBand(score: number): { key: 'good' | 'average' | 'poor'; label: string } {
  if (score >= 90) return { key: 'good', label: 'Good' };
  if (score >= 50) return { key: 'average', label: 'Needs improvement' };
  return { key: 'poor', label: 'Poor' };
}
