import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { QualityReport } from '@my-resume/api-models';
import { runCli } from './cli.ts';
import {
  ciJobs,
  ciRun,
  coverageSummary,
  frontendProject,
  frontendStats,
  nxGraph,
  vitestReport,
} from './lib/fixtures/quality-inputs.ts';

const now = new Date('2026-10-31T10:03:30Z');

describe('quality-report CLI', () => {
  let dir: string;

  function write(path: string, content: unknown): string {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(content));
    return file;
  }

  function readReport(path: string): QualityReport {
    return JSON.parse(readFileSync(join(dir, path), 'utf8')) as QualityReport;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'quality-report-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads every input and writes the report', () => {
    write('coverage/backend/test-results.json', vitestReport(20, 1, 1, 1));
    write(
      'coverage/backend/coverage-summary.json',
      coverageSummary([80, 100], [160, 200], [30, 40], [45, 60]),
    );
    write('coverage/integration/backend/test-results.json', vitestReport(15));
    write(
      'coverage/integration/backend/coverage-summary.json',
      coverageSummary([70, 100], [140, 200], [20, 40], [30, 60]),
    );
    write('coverage/frontend/test-results.json', vitestReport(30));
    // a stale directory from the old root-based layout is ignored
    write('coverage/apps/backend/test-results.json', vitestReport(99));

    const out = runCli(
      [
        '--coverage-dir',
        join(dir, 'coverage'),
        '--nx-graph',
        write('graph.json', nxGraph),
        '--frontend-stats',
        write('stats.json', frontendStats),
        '--frontend-project',
        write('project.json', frontendProject),
        '--ci-run',
        write('run.json', ciRun),
        '--ci-jobs',
        write('jobs.json', ciJobs),
        '--out',
        join(dir, 'out/nested/report.json'),
      ],
      now,
    );

    const report = readReport('out/nested/report.json');
    expect(report).toEqual(out);
    expect(report.generatedAt).toBe('2026-10-31T10:03:30.000Z');
    expect(report.tests.projects.map((p) => [p.project, p.suite, p.total])).toEqual([
      ['backend', 'unit', 23],
      ['frontend', 'unit', 30],
      ['backend', 'integration', 15],
    ]);
    expect(report.coverage.map((c) => [c.project, c.suite, c.metrics.lines])).toEqual([
      ['backend', 'unit', 80],
      ['backend', 'integration', 70],
    ]);
    expect(report.bundle).toEqual({
      initialBytes: 550,
      lazyBytes: 1000,
      budgetWarningBytes: 500_000,
      budgetErrorBytes: 1_000_000,
    });
    expect(report.build?.commit).toBe(ciRun.head_sha);
    expect(report.build?.jobs).toEqual([{ name: 'Unit tests', durationSeconds: 120 }]);
  });

  it('leaves the sections of missing optional files empty', () => {
    runCli(
      [
        '--coverage-dir',
        join(dir, 'no-coverage'),
        '--nx-graph',
        write('graph.json', nxGraph),
        '--frontend-stats',
        join(dir, 'missing-stats.json'),
        '--frontend-project',
        join(dir, 'missing-project.json'),
        '--out',
        join(dir, 'report.json'),
      ],
      now,
    );

    const report = readReport('report.json');
    expect(report.tests.suites).toEqual([]);
    expect(report.coverage).toEqual([]);
    expect(report.bundle).toBeNull();
    expect(report.build).toBeNull();
    expect(report.lighthouse).toBeNull();
    expect(report.projectGraph.nodes).toHaveLength(5);
  });

  it('fails without the project graph', () => {
    expect(() => runCli(['--out', join(dir, 'report.json')], now)).toThrow(/--nx-graph/);
    expect(() =>
      runCli(['--nx-graph', join(dir, 'missing.json'), '--out', join(dir, 'report.json')], now),
    ).toThrow(/missing\.json/);
  });

  it('rejects an unknown option', () => {
    expect(() =>
      runCli(['--nx-graph', write('graph.json', nxGraph), '--colour', 'red'], now),
    ).toThrow();
  });
});
