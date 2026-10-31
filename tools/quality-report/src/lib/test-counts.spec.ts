import { sumTestCounts, testCountsFromVitest } from './test-counts.ts';

describe('testCountsFromVitest', () => {
  it('counts passed, failed and skipped (skipped + todo) tests', () => {
    expect(
      testCountsFromVitest({
        numPassedTests: 7,
        numFailedTests: 1,
        numPendingTests: 2,
        numTodoTests: 1,
      }),
    ).toEqual({ total: 11, passed: 7, failed: 1, skipped: 3, passRate: 87.5 });
  });

  it('rounds the pass rate to one decimal', () => {
    // 2 / 3 = 66.666…
    expect(
      testCountsFromVitest({
        numPassedTests: 2,
        numFailedTests: 1,
        numPendingTests: 0,
        numTodoTests: 0,
      }).passRate,
    ).toBe(66.7);
  });

  it('has a 100% pass rate when nothing failed', () => {
    expect(
      testCountsFromVitest({
        numPassedTests: 4,
        numFailedTests: 0,
        numPendingTests: 1,
        numTodoTests: 0,
      }).passRate,
    ).toBe(100);
  });

  it('has a null pass rate when no test ran (only skipped ones)', () => {
    expect(
      testCountsFromVitest({
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 2,
        numTodoTests: 1,
      }),
    ).toEqual({ total: 3, passed: 0, failed: 0, skipped: 3, passRate: null });
  });

  it('has a null pass rate for an empty run', () => {
    expect(
      testCountsFromVitest({
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
      }),
    ).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0, passRate: null });
  });
});

describe('sumTestCounts', () => {
  it('adds the counts and recalculates the pass rate from the sums', () => {
    expect(
      sumTestCounts([
        { total: 10, passed: 9, failed: 1, skipped: 0, passRate: 90 },
        { total: 4, passed: 1, failed: 1, skipped: 2, passRate: 50 },
      ]),
    ).toEqual({ total: 14, passed: 10, failed: 2, skipped: 2, passRate: 83.3 });
  });

  it('is all zeros with a null pass rate for no counts', () => {
    expect(sumTestCounts([])).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: null,
    });
  });
});
