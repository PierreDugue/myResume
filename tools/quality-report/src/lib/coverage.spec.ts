import type { CoverageSummary } from './inputs.ts';
import { coverageFromSummary } from './coverage.ts';

function summary(
  lines: [number, number],
  statements: [number, number],
  functions: [number, number],
  branches: [number, number],
): CoverageSummary {
  const metric = ([covered, total]: [number, number]) => ({
    total,
    covered,
    pct: total === 0 ? (100 as const) : Math.round((covered / total) * 10000) / 100,
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

describe('coverageFromSummary', () => {
  it('reads the total percentages, rounded to one decimal', () => {
    expect(coverageFromSummary(summary([90, 100], [2, 3], [1, 8], [5, 5]))).toEqual({
      lines: 90,
      statements: 66.7,
      functions: 12.5,
      branches: 100,
    });
  });

  it('rounds from the counts, not from istanbul’s already rounded percentage', () => {
    // 1 / 8 = 12.5 exactly, 123 / 1000 = 12.3; 1235 / 10000 = 12.35 → 12.4 (half up)
    expect(coverageFromSummary(summary([1235, 10000], [123, 1000], [1, 8], [0, 4]))).toEqual({
      lines: 12.4,
      statements: 12.3,
      functions: 12.5,
      branches: 0,
    });
  });

  it('counts a metric with nothing to cover (e.g. no branches) as 100%, like istanbul', () => {
    expect(coverageFromSummary(summary([3, 4], [3, 4], [1, 1], [0, 0]))?.branches).toBe(100);
  });

  it('is null for a project without runtime code (0 statements, e.g. api-models)', () => {
    const empty: CoverageSummary = {
      total: {
        lines: { total: 0, covered: 0, pct: 'Unknown' },
        statements: { total: 0, covered: 0, pct: 'Unknown' },
        functions: { total: 0, covered: 0, pct: 'Unknown' },
        branches: { total: 0, covered: 0, pct: 'Unknown' },
      },
    };
    expect(coverageFromSummary(empty)).toBeNull();
  });
});
