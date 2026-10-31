import type { TestCounts } from '@my-resume/api-models';
import type { VitestJsonReport } from './inputs.ts';
import { percent } from './numbers.ts';

function counts(passed: number, failed: number, skipped: number): TestCounts {
  return {
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    passRate: passed + failed === 0 ? null : percent(passed, passed + failed),
  };
}

/** Vitest JSON reporter output → counts; `skipped` includes todo tests. */
export function testCountsFromVitest(report: VitestJsonReport): TestCounts {
  return counts(
    report.numPassedTests,
    report.numFailedTests,
    report.numPendingTests + report.numTodoTests,
  );
}

/** Adds counts together; the pass rate is recalculated from the sums. */
export function sumTestCounts(list: TestCounts[]): TestCounts {
  return counts(
    list.reduce((sum, c) => sum + c.passed, 0),
    list.reduce((sum, c) => sum + c.failed, 0),
    list.reduce((sum, c) => sum + c.skipped, 0),
  );
}
