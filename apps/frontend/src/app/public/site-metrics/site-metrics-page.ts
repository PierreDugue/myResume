import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ThemeService } from '../../core/theme/theme.service';
import { readChartPalette } from '../../shared/panels/chart-palette';
import { EChart } from '../../shared/panels/echart/echart';
import type { ChartOption } from '../../shared/panels/echart/echarts-loader';
import { Panel } from '../../shared/panels/panel/panel';
import { StatPanel } from '../../shared/panels/stat/stat-panel';
import { LiveBadge } from '../../shared/refresh/live-badge/live-badge';
import { RefreshPicker } from '../../shared/refresh/refresh-picker/refresh-picker';
import { parseRefreshMode, type RefreshMode } from '../../shared/refresh/refresh-mode';
import { cpuOption } from './charts/cpu-option';
import { eventLoopOption } from './charts/event-loop-option';
import { gcOption } from './charts/gc-option';
import { memoryOption } from './charts/memory-option';
import { ProcessMetricsStore } from './process-metrics.store';
import { WINDOW_SECONDS, newest, withinSeconds } from './sample-window';
import {
  cpuTable,
  eventLoopTable,
  gcTable,
  memoryTable,
  processStats,
  type TableView,
} from './site-metrics-view';
import { StreamInspector } from './stream-inspector/stream-inspector';

interface ChartPanel {
  id: string;
  title: string;
  info: string;
  /** Text alternative of the chart (the table is the other one). */
  label: string;
  option: ChartOption;
  table: TableView;
}

/**
 * "This site, observed": the health of the backend's own Node.js process (event loop, memory,
 * CPU, GC, uptime), live over a WebSocket or polled over HTTP. The page reads the refresh mode
 * from the URL and wires the panels; the data and the choice of source are in the store.
 */
@Component({
  selector: 'app-site-metrics-page',
  imports: [Panel, StatPanel, EChart, RefreshPicker, LiveBadge, StreamInspector],
  templateUrl: './site-metrics-page.html',
  styleUrl: './site-metrics-page.scss',
  // Lives and dies with the page: leaving it unsubscribes, and the socket closes shortly after.
  providers: [ProcessMetricsStore],
})
export class SiteMetricsPage {
  protected readonly store = inject(ProcessMetricsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  private readonly modes$ = this.route.queryParamMap.pipe(
    map((params) => parseRefreshMode(params.get('refresh'))),
    distinctUntilChanged(),
  );
  protected readonly mode = toSignal(this.modes$, { requireSync: true });
  /** Which charts are shown as a table instead, by panel id. */
  protected readonly tables = signal<Record<string, boolean>>({});

  private readonly palette = computed(() => {
    this.theme.theme(); // re-read the CSS tokens when the theme changes
    return readChartPalette(this.document.documentElement);
  });

  /** The last 2 minutes, measured from the newest sample: what the charts and tables show. */
  protected readonly window = computed(() => withinSeconds(this.store.samples(), WINDOW_SECONDS));

  protected readonly stats = computed(() => {
    const samples = this.store.samples();
    const uptime = this.store.uptimeSeconds() ?? newest(samples)?.uptimeSeconds ?? 0;
    return processStats(samples, uptime);
  });

  protected readonly charts = computed<ChartPanel[]>(() => {
    const window = this.window();
    const palette = this.palette();
    return [
      {
        id: 'event-loop',
        title: 'Event loop lag',
        info: 'How late the backend is to run its callbacks, per second: the median (p50) and the slowest 1% (p99). A busy process lags.',
        label: 'Line chart of the backend event loop lag, p50 and p99, over the last 2 minutes',
        option: eventLoopOption(window, palette),
        table: eventLoopTable(window),
      },
      {
        id: 'memory',
        title: 'Memory',
        info: 'Memory of the backend process: RSS is what the operating system gave it, the heap is what JavaScript objects use (total reserved, and used).',
        label:
          'Line chart of the backend memory, RSS, heap total and heap used, over the last 2 minutes',
        option: memoryOption(window, palette),
        table: memoryTable(window),
      },
      {
        id: 'cpu',
        title: 'CPU',
        info: 'CPU time the backend process used, as a share of one core. It can go above 100 % when work runs on several threads.',
        label: 'Line chart of the backend CPU use over the last 2 minutes',
        option: cpuOption(window, palette),
        table: cpuTable(window),
      },
      {
        id: 'gc',
        title: 'Garbage collection',
        info: 'Time the backend paused to free memory, per second. Minor collections are quick and frequent; major ones (hatched bars) are rarer and longer.',
        label:
          'Bar chart of the backend garbage collection pauses, minor and major, over the last 2 minutes',
        option: gcOption(window, palette),
        table: gcTable(window),
      },
    ];
  });

  protected setMode(mode: RefreshMode): void {
    // `live` is the default, so it is left out of the URL.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { refresh: mode === 'live' ? null : mode },
      queryParamsHandling: 'merge',
    });
  }

  protected setTable(id: string, shown: boolean): void {
    this.tables.update((tables) => ({ ...tables, [id]: shown }));
  }

  constructor() {
    this.store.follow(this.modes$);
  }
}
