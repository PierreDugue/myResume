import { HttpErrorResponse } from '@angular/common/http';
import { Component, DOCUMENT, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { LogsQuery, LogsResponse } from '@my-resume/api-models';
import { withLabelMatcher } from '@my-resume/query-parser';
import { map } from 'rxjs';
import { apiErrorMessage } from '../../core/content/content-api.service';
import { LogsApi } from '../../core/logs/logs-api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { readChartPalette } from '../../shared/panels/chart-palette';
import { EChart } from '../../shared/panels/echart/echart';
import { Panel } from '../../shared/panels/panel/panel';
import { logVolumeOption, VOLUME_LEVELS } from './charts/log-volume-option';
import { parseExploreQuery, toExploreParams } from './explore-query';
import { LabelFilter, LogList } from './log-list/log-list';
import { QueryBar } from './query-bar/query-bar';

/** Example queries to click, chosen to return lines on the seeded resume. */
export const EXAMPLE_QUERIES = [
  '{level="achievement"} |~ "\\d+%"',
  '{tech="Angular"} != "AngularJS"',
  '{type="education"}',
  'migration',
];

/**
 * Explore: the resume as logs, searched with a LogQL-style query. The URL holds the view
 * (?query&from&to), so every search can be shared; each change goes through the URL.
 */
@Component({
  selector: 'app-explore-page',
  imports: [Panel, EChart, QueryBar, LogList],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
})
export class ExplorePage {
  private readonly api = inject(LogsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  protected readonly examples = EXAMPLE_QUERIES;
  protected readonly levels = VOLUME_LEVELS;
  protected readonly volumeTable = signal(false);

  protected readonly query = toSignal(this.route.queryParamMap.pipe(map(parseExploreQuery)), {
    initialValue: parseExploreQuery(this.route.snapshot.queryParamMap),
  });
  protected readonly logs = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.search(params),
  });
  private readonly labelsResource = rxResource({ stream: () => this.api.labels() });
  protected readonly labels = computed(() =>
    this.labelsResource.hasValue() ? this.labelsResource.value() : [],
  );

  /** The latest results, kept on screen while the next search loads. */
  protected readonly data = linkedSignal<LogsResponse | undefined, LogsResponse | undefined>({
    source: () => (this.logs.hasValue() ? this.logs.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  /** A query the server refused (400): shown in the query bar. */
  protected readonly queryError = computed(() => {
    const error = this.logs.error();
    return error instanceof HttpErrorResponse && error.status === 400
      ? apiErrorMessage(error)
      : null;
  });
  /** Any other failure: the page offers to retry. */
  protected readonly loadError = computed(() => !!this.logs.error() && !this.queryError());

  /** The view as shown: URL values, with the API defaults filled in. */
  protected readonly view = computed<LogsQuery>(() => {
    const q = this.query();
    const range = this.data()?.range;
    return { ...q, from: q.from ?? range?.from, to: q.to ?? range?.to };
  });

  protected readonly years = computed(() => {
    const bounds = this.data()?.bounds;
    if (!bounds) return [];
    return Array.from({ length: bounds.to - bounds.from + 1 }, (_, i) => bounds.from + i);
  });

  private readonly palette = computed(() => {
    this.theme.theme(); // re-read the CSS tokens when the theme changes
    return readChartPalette(this.document.documentElement);
  });
  protected readonly volumeOption = computed(() => {
    const data = this.data();
    return data ? logVolumeOption(data.volume, this.palette()) : null;
  });

  protected runQuery(text: string): void {
    this.navigate({ ...this.query(), query: text });
  }

  /** Narrows the current query from a line's label. */
  protected narrow({ label, value, op }: LabelFilter): void {
    this.runQuery(withLabelMatcher(this.query().query ?? '', label, value, op));
  }

  protected setYear(key: 'from' | 'to', value: string): void {
    const view = { ...this.view(), [key]: Number(value) };
    // Keep the range valid: moving one end past the other moves both.
    if (view.from !== undefined && view.to !== undefined && view.from > view.to) {
      if (key === 'from') view.to = view.from;
      else view.from = view.to;
    }
    this.navigate(view);
  }

  protected allYears(): void {
    this.navigate({ query: this.query().query });
  }

  private navigate(query: LogsQuery): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toExploreParams(query) });
  }
}
