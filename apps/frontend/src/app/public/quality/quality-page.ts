import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { QualityApi } from '../../core/quality/quality-api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { BarGauge } from '../../shared/panels/bar-gauge/bar-gauge';
import { readChartPalette } from '../../shared/panels/chart-palette';
import { EChart } from '../../shared/panels/echart/echart';
import { Panel } from '../../shared/panels/panel/panel';
import { StatPanel } from '../../shared/panels/stat/stat-panel';
import { projectGraphOption } from './charts/project-graph-option';
import { BundleBudget } from './panels/bundle-budget/bundle-budget';
import { LighthouseScores } from './panels/lighthouse-scores/lighthouse-scores';
import { TestResults } from './panels/test-results/test-results';
import { coverageGroups, coverageRows, graphRows, jobGroups, qualityStats } from './quality-view';

/**
 * "This codebase, observed": the CI pipeline's report for the running build (tests, coverage,
 * bundle, Lighthouse, build jobs, Nx project graph). A build without a report shows an empty state.
 */
@Component({
  selector: 'app-quality-page',
  imports: [Panel, StatPanel, BarGauge, EChart, TestResults, BundleBudget, LighthouseScores],
  templateUrl: './quality-page.html',
  styleUrl: './quality-page.scss',
})
export class QualityPage {
  private readonly api = inject(QualityApi);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  protected readonly report = rxResource({ stream: () => this.api.get() });
  protected readonly showCoverageTable = signal(false);
  protected readonly showGraphTable = signal(false);

  private readonly palette = computed(() => {
    this.theme.theme(); // re-read the CSS tokens when the theme changes
    return readChartPalette(this.document.documentElement);
  });

  /** Everything the dashboard shows, mapped from the report (null: this build has none). */
  protected readonly view = computed(() => {
    const report = this.report.hasValue() ? this.report.value() : null;
    if (!report) return null;
    return {
      report,
      stats: qualityStats(report),
      coverage: coverageGroups(report.coverage),
      coverageRows: coverageRows(report.coverage),
      jobs: jobGroups(report.build),
      graphRows: graphRows(report.projectGraph),
      graphOption: projectGraphOption(report.projectGraph, this.palette()),
    };
  });
}
