import type { QualityReport } from '@my-resume/api-models';
import { assembleReport } from './assemble.ts';
import { coverageSummary, fullInputs, nxGraph, vitestReport } from './fixtures/quality-inputs.ts';

const now = new Date('2026-10-31T10:03:30Z');

describe('assembleReport', () => {
  it('assembles the whole report from every input', () => {
    const expected: QualityReport = {
      schemaVersion: 1,
      generatedAt: '2026-10-31T10:03:30.000Z',
      build: {
        commit: 'abc123abc123abc123abc123abc123abc123abc1',
        commitUrl:
          'https://github.com/octo/my-resume/commit/abc123abc123abc123abc123abc123abc123abc1',
        branch: 'main',
        runUrl: 'https://github.com/octo/my-resume/actions/runs/7',
        startedAt: '2026-10-31T10:00:00Z',
        durationSeconds: 210,
        jobs: [{ name: 'Unit tests', durationSeconds: 120 }],
      },
      tests: {
        // 75 passed, 1 failed, 2 skipped: 75 / 76 = 98.68…
        total: { total: 78, passed: 75, failed: 1, skipped: 2, passRate: 98.7 },
        suites: [
          // 60 / 61 = 98.36…
          { suite: 'unit', total: 63, passed: 60, failed: 1, skipped: 2, passRate: 98.4 },
          { suite: 'integration', total: 15, passed: 15, failed: 0, skipped: 0, passRate: 100 },
        ],
        projects: [
          // 20 / 21 = 95.23…
          {
            project: 'backend',
            suite: 'unit',
            total: 23,
            passed: 20,
            failed: 1,
            skipped: 2,
            passRate: 95.2,
          },
          {
            project: 'frontend',
            suite: 'unit',
            total: 30,
            passed: 30,
            failed: 0,
            skipped: 0,
            passRate: 100,
          },
          {
            project: 'query-parser',
            suite: 'unit',
            total: 10,
            passed: 10,
            failed: 0,
            skipped: 0,
            passRate: 100,
          },
          {
            project: 'backend',
            suite: 'integration',
            total: 15,
            passed: 15,
            failed: 0,
            skipped: 0,
            passRate: 100,
          },
        ],
      },
      coverage: [
        {
          project: 'backend',
          kind: 'app',
          suite: 'unit',
          metrics: { lines: 80, statements: 80, functions: 75, branches: 75 },
        },
        {
          project: 'backend',
          kind: 'app',
          suite: 'integration',
          metrics: { lines: 70, statements: 70, functions: 50, branches: 50 },
        },
        {
          project: 'frontend',
          kind: 'app',
          suite: 'unit',
          metrics: { lines: 90, statements: 90, functions: 90, branches: 90 },
        },
        {
          project: 'query-parser',
          kind: 'lib',
          suite: 'unit',
          metrics: { lines: 99, statements: 99, functions: 99, branches: 99 },
        },
      ],
      bundle: {
        initialBytes: 550,
        lazyBytes: 1000,
        budgetWarningBytes: 500_000,
        budgetErrorBytes: 1_000_000,
      },
      lighthouse: null,
      projectGraph: {
        nodes: [
          { name: 'backend', kind: 'app', root: 'apps/backend' },
          { name: 'frontend', kind: 'app', root: 'apps/frontend' },
          { name: 'frontend-e2e', kind: 'e2e', root: 'apps/frontend-e2e' },
          { name: 'api-models', kind: 'lib', root: 'libs/shared/api-models' },
          { name: 'query-parser', kind: 'lib', root: 'libs/shared/query-parser' },
        ],
        edges: [
          { source: 'backend', target: 'api-models' },
          { source: 'frontend', target: 'api-models' },
          { source: 'frontend', target: 'query-parser' },
          { source: 'frontend-e2e', target: 'frontend' },
        ],
      },
    };

    expect(assembleReport(fullInputs, now)).toEqual(expected);
  });

  it('has empty sections when only the project graph is available (a local run before any test)', () => {
    const report = assembleReport(
      {
        nxGraph,
        projects: [],
        frontendStats: null,
        frontendProject: null,
        ciRun: null,
        ciJobs: null,
      },
      now,
    );

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt: '2026-10-31T10:03:30.000Z',
      build: null,
      tests: {
        total: { total: 0, passed: 0, failed: 0, skipped: 0, passRate: null },
        suites: [],
        projects: [],
      },
      coverage: [],
      bundle: null,
      lighthouse: null,
    });
    expect(report.projectGraph.nodes).toHaveLength(5);
  });

  it('measures tests without coverage (tests run without --coverage)', () => {
    const report = assembleReport(
      {
        ...fullInputs,
        projects: [
          {
            project: 'backend',
            suite: 'unit',
            testResults: vitestReport(3),
            coverageSummary: null,
          },
        ],
      },
      now,
    );

    expect(report.tests.suites).toEqual([
      { suite: 'unit', total: 3, passed: 3, failed: 0, skipped: 0, passRate: 100 },
    ]);
    expect(report.coverage).toEqual([]);
  });

  it('leaves out a suite where no project has tests', () => {
    const report = assembleReport(
      {
        ...fullInputs,
        projects: [
          {
            project: 'backend',
            suite: 'integration',
            testResults: vitestReport(0),
            coverageSummary: null,
          },
          {
            project: 'frontend',
            suite: 'unit',
            testResults: vitestReport(2),
            coverageSummary: null,
          },
        ],
      },
      now,
    );

    expect(report.tests.suites.map((s) => s.suite)).toEqual(['unit']);
    expect(report.tests.projects.map((p) => p.project)).toEqual(['frontend']);
  });

  it('ignores reports of projects that are not in the graph', () => {
    const report = assembleReport(
      {
        ...fullInputs,
        projects: [
          {
            project: 'old-lib',
            suite: 'unit',
            testResults: vitestReport(4),
            coverageSummary: coverageSummary([1, 1], [1, 1], [1, 1], [1, 1]),
          },
        ],
      },
      now,
    );

    expect(report.tests.projects).toEqual([]);
    expect(report.coverage).toEqual([]);
  });

  it('measures the bundle without budgets when the project file is missing', () => {
    expect(assembleReport({ ...fullInputs, frontendProject: null }, now).bundle).toEqual({
      initialBytes: 550,
      lazyBytes: 1000,
      budgetWarningBytes: null,
      budgetErrorBytes: null,
    });
  });

  it('has no build outside GitHub Actions (no run file), even with a jobs file', () => {
    expect(assembleReport({ ...fullInputs, ciRun: null }, now).build).toBeNull();
  });
});
