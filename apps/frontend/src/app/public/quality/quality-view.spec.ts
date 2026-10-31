import type { GaugeGroup } from '../../shared/panels/bar-gauge/bar-gauge';
import {
  coverageGroups,
  coverageRows,
  formatPassRate,
  graphRows,
  jobGroups,
  lighthouseBand,
  projectRows,
  qualityStats,
  suiteRows,
} from './quality-view';
import { partialQualityFixture, qualityFixture } from './testing/quality-fixture';

describe('qualityStats', () => {
  it('summarises a full report in five stats', () => {
    expect(qualityStats(qualityFixture())).toEqual([
      { label: 'Tests', display: '700', hint: '2 failed, 4 skipped' },
      { label: 'Pass rate', display: '99.7 %', hint: 'skipped tests excluded' },
      { label: 'Initial bundle', display: '412.3 kB', hint: 'of 500.0 kB budget' },
      { label: 'CI duration', display: '6 min 12 s', hint: 'checks run in parallel' },
      { label: 'Last deploy', display: '2026-10-31 14:02 UTC', hint: 'commit a1b2c3d' },
    ]);
  });

  it('says so when nothing failed or was skipped', () => {
    const report = qualityFixture();
    report.tests.total = { total: 5, passed: 5, failed: 0, skipped: 0, passRate: 100 };
    expect(qualityStats(report)[0].hint).toBe('all passing');
  });

  it('shows dashes for what a partial report lacks', () => {
    expect(qualityStats(partialQualityFixture())).toEqual([
      { label: 'Tests', display: '20', hint: 'all passing' },
      { label: 'Pass rate', display: '100.0 %', hint: 'skipped tests excluded' },
      { label: 'Initial bundle', display: '–', hint: 'not measured yet' },
      { label: 'CI duration', display: '–', hint: 'not built in CI' },
      { label: 'Last deploy', display: '2026-10-31 14:02 UTC', hint: null },
    ]);
  });

  it('leaves out the budget when the report has none', () => {
    const report = qualityFixture();
    report.bundle = {
      initialBytes: 412340,
      lazyBytes: 0,
      budgetWarningBytes: null,
      budgetErrorBytes: null,
    };
    expect(qualityStats(report)[2]).toEqual({
      label: 'Initial bundle',
      display: '412.3 kB',
      hint: null,
    });
  });

  it('shows a dash when no test ran', () => {
    expect(formatPassRate(null)).toBe('–');
    expect(formatPassRate(100)).toBe('100.0 %');
    expect(formatPassRate(99.7)).toBe('99.7 %');
  });
});

describe('suiteRows', () => {
  it('always lists unit, integration and e2e, with e2e marked as not run', () => {
    const rows = suiteRows(qualityFixture().tests);
    expect(rows.map((r) => [r.name, r.counts?.total ?? null])).toEqual([
      ['Unit', 640],
      ['Integration', 60],
      ['End-to-end', null],
    ]);
  });

  it('marks every missing suite', () => {
    const rows = suiteRows(partialQualityFixture().tests);
    expect(rows.map((r) => r.counts === null)).toEqual([false, true, true]);
  });
});

describe('projectRows', () => {
  it('names each project with its suite', () => {
    expect(projectRows(qualityFixture().tests).map((r) => [r.name, r.counts?.total])).toEqual([
      ['backend · unit', 250],
      ['frontend · unit', 330],
      ['query-parser · unit', 40],
      ['resume-metrics · unit', 20],
      ['backend · integration', 60],
    ]);
  });
});

describe('coverageGroups', () => {
  let groups: GaugeGroup[];
  beforeEach(() => (groups = coverageGroups(qualityFixture().coverage)));

  it('groups apps and libraries', () => {
    expect(groups.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      ['Apps', ['backend', 'backend · integration', 'frontend']],
      ['Libraries', ['query-parser', 'resume-metrics']],
    ]);
  });

  it('uses the lines percentage as the value, with the other metrics as a note', () => {
    expect(groups[0].items[0]).toEqual({
      label: 'backend',
      value: 91.2,
      display: '91.2 %',
      note: 'stmts 90.8 · funcs 88.0 · branches 80.5',
    });
  });

  it('leaves out an empty group, and everything when nothing was measured', () => {
    expect(coverageGroups(qualityFixture().coverage.filter((c) => c.kind === 'lib'))).toHaveLength(
      1,
    );
    expect(coverageGroups([])).toEqual([]);
  });
});

describe('coverageRows', () => {
  it('has the four metrics for every project', () => {
    expect(coverageRows(qualityFixture().coverage)[1]).toEqual({
      name: 'backend · integration',
      kind: 'App',
      lines: '62.4 %',
      statements: '61.9 %',
      functions: '55.2 %',
      branches: '40.1 %',
    });
  });
});

describe('jobGroups', () => {
  it('lists the pipeline jobs with their durations', () => {
    const groups = jobGroups(qualityFixture().build);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => [i.label, i.value, i.display])).toEqual([
      ['Lint', 95, '1 min 35 s'],
      ['Unit tests', 210, '3 min 30 s'],
      ['Integration tests', 128, '2 min 8 s'],
      ['Build', 150, '2 min 30 s'],
    ]);
  });

  it('is empty without a build or without jobs', () => {
    expect(jobGroups(null)).toEqual([]);
    const build = qualityFixture().build;
    expect(jobGroups(build && { ...build, jobs: [] })).toEqual([]);
  });
});

describe('graphRows', () => {
  it('lists each project with its kind, root and dependencies', () => {
    const rows = graphRows(qualityFixture().projectGraph);
    expect(rows[0]).toEqual({
      name: 'backend',
      kind: 'App',
      root: 'apps/backend',
      dependsOn: 'api-models, query-parser, resume-metrics',
    });
    expect(rows[2]).toMatchObject({
      name: 'frontend-e2e',
      kind: 'End-to-end',
      dependsOn: 'frontend',
    });
    expect(rows[3]).toMatchObject({ name: 'api-models', kind: 'Library', dependsOn: '–' });
  });
});

describe('lighthouseBand', () => {
  it.each([
    [0, 'poor', 'Poor'],
    [49, 'poor', 'Poor'],
    [50, 'average', 'Needs improvement'],
    [89, 'average', 'Needs improvement'],
    [90, 'good', 'Good'],
    [100, 'good', 'Good'],
  ])('puts %s in the %s band', (score, key, label) => {
    expect(lighthouseBand(score)).toEqual({ key, label });
  });
});
