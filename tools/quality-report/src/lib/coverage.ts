import type { CoverageMetrics } from '@my-resume/api-models';
import type { CoverageSummary, CoverageSummaryMetric } from './inputs.ts';
import { percent } from './numbers.ts';

/** Like istanbul, a metric with nothing to cover counts as 100%. Recomputed from the counts: istanbul's `pct` is already rounded. */
function metricPercent({ covered, total }: CoverageSummaryMetric): number {
  return total === 0 ? 100 : percent(covered, total);
}

/** istanbul `coverage-summary.json` → percentages; null for a project without runtime code (0 statements). */
export function coverageFromSummary(summary: CoverageSummary): CoverageMetrics | null {
  const { lines, statements, functions, branches } = summary.total;
  if (statements.total === 0) {
    return null;
  }
  return {
    lines: metricPercent(lines),
    statements: metricPercent(statements),
    functions: metricPercent(functions),
    branches: metricPercent(branches),
  };
}
