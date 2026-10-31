import { Component, computed, input } from '@angular/core';
import type { BundleSize } from '@my-resume/api-models';
import { formatBytes } from '../../../../shared/format/bytes';

type Verdict = 'ok' | 'warn' | 'error' | 'none';

/**
 * The initial bundle against its warning and error budgets: a plain HTML/CSS meter with markers.
 * The verdict and every value are also text, so color is never the only signal.
 */
@Component({
  selector: 'app-bundle-budget',
  templateUrl: './bundle-budget.html',
  styleUrl: './bundle-budget.scss',
})
export class BundleBudget {
  readonly bundle = input.required<BundleSize>();

  protected readonly view = computed(() => {
    const {
      initialBytes,
      lazyBytes,
      budgetWarningBytes: warning,
      budgetErrorBytes: error,
    } = this.bundle();
    const scale = Math.max(initialBytes, warning ?? 0, error ?? 0);
    const at = (bytes: number) => `${scale > 0 ? +((bytes / scale) * 100).toFixed(1) : 0}%`;

    let verdict: Verdict = 'none';
    let status = 'No budget set';
    if (error !== null && initialBytes > error) {
      verdict = 'error';
      status = `Over the error budget by ${formatBytes(initialBytes - error)}`;
    } else if (warning !== null && initialBytes > warning) {
      verdict = 'warn';
      status = `Over the warning budget by ${formatBytes(initialBytes - warning)}`;
    } else if (warning !== null) {
      verdict = 'ok';
      status = `Within budget: ${formatBytes(warning - initialBytes)} below the warning budget`;
    } else if (error !== null) {
      verdict = 'ok';
      status = `Within budget: ${formatBytes(error - initialBytes)} below the error budget`;
    }

    return {
      verdict,
      status,
      initial: formatBytes(initialBytes),
      lazy: formatBytes(lazyBytes),
      fill: at(initialBytes),
      warning: warning === null ? null : { text: formatBytes(warning), left: at(warning) },
      error: error === null ? null : { text: formatBytes(error), left: at(error) },
    };
  });
}
