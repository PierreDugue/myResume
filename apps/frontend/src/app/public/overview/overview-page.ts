import {
  Component,
  DOCUMENT,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { DashboardQuery, DashboardResponse } from '@my-resume/api-models';
import { map } from 'rxjs';
import { DashboardApi } from '../../core/dashboard/dashboard-api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { PageAccess } from '../../layout/page-access';
import { BarGauge, GaugeGroup } from '../../shared/panels/bar-gauge/bar-gauge';
import { readChartPalette } from '../../shared/panels/chart-palette';
import { EChart } from '../../shared/panels/echart/echart';
import { Panel } from '../../shared/panels/panel/panel';
import { StatPanel } from '../../shared/panels/stat/stat-panel';
import { heatmapOption } from './charts/heatmap-option';
import { skillUsageOption } from './charts/skill-usage-option';
import { parseDashboardQuery, toQueryParams } from './dashboard-query';
import { ImpactList } from './panels/impacts/impact-list';
import { LogPreview } from './panels/logs/log-preview';
import { ProfilePanel } from './panels/profile/profile-panel';
import { CareerTimeline } from './panels/timeline/career-timeline';

const HEATMAP_TOP = 15;
const USAGE_INFO =
  'Years of experience accumulated with each skill, counting every month of the jobs and projects that used it.';

/**
 * Home dashboard ("Career Overview"). The URL holds the view (?from&to&category&skill), so any view
 * can be shared; every change goes through the URL and reloads GET /api/dashboard.
 */
@Component({
  selector: 'app-overview-page',
  imports: [
    Panel,
    StatPanel,
    BarGauge,
    EChart,
    CareerTimeline,
    ImpactList,
    LogPreview,
    ProfilePanel,
  ],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
})
export class OverviewPage {
  private readonly api = inject(DashboardApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly theme = inject(ThemeService);
  protected readonly access = inject(PageAccess);
  private readonly document = inject(DOCUMENT);

  protected readonly query = toSignal(this.route.queryParamMap.pipe(map(parseDashboardQuery)), {
    initialValue: parseDashboardQuery(this.route.snapshot.queryParamMap),
  });
  protected readonly dashboard = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.get(params),
  });
  /** The latest data, kept on screen while the next view loads. */
  protected readonly data = linkedSignal<
    DashboardResponse | undefined,
    DashboardResponse | undefined
  >({
    source: () => (this.dashboard.hasValue() ? this.dashboard.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  /**
   * The control that started the current load. Disabling it while loading drops its focus to the
   * page, so keyboard users get it back once the controls are enabled again.
   */
  private focusToRestore: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      if (this.dashboard.isLoading()) return;
      const target = this.focusToRestore;
      this.focusToRestore = null;
      const active = this.document.activeElement;
      // Only when the focus was lost, not when the visitor moved it elsewhere meanwhile.
      if (target?.isConnected && (!active || active === this.document.body)) target.focus();
    });
  }

  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly usageTable = signal(false);
  protected readonly heatmapTable = signal(false);

  /** The view as shown: URL values, with the API defaults filled in. */
  protected readonly view = computed<DashboardQuery>(() => {
    const q = this.query();
    const range = this.data()?.range;
    return { ...q, from: q.from ?? range?.from, to: q.to ?? range?.to };
  });

  protected readonly years = computed(() => {
    const filters = this.data()?.filters;
    if (!filters) return [];
    return Array.from(
      { length: filters.maxYear - filters.minYear + 1 },
      (_, i) => filters.minYear + i,
    );
  });

  protected readonly skillGroups = computed(() => {
    const groups = new Map<string, { slug: string; name: string }[]>();
    for (const skill of this.data()?.filters.skills ?? []) {
      groups.set(skill.category, [...(groups.get(skill.category) ?? []), skill]);
    }
    return [...groups].map(([category, skills]) => ({ category, skills }));
  });

  private readonly palette = computed(() => {
    this.theme.theme(); // re-read the CSS tokens when the theme changes
    return readChartPalette(this.document.documentElement);
  });

  protected readonly usageSeries = computed(() => this.data()?.skillsOverTime.series ?? []);
  protected readonly heatmapSeries = computed(
    () => this.data()?.skillUsage.series.slice(0, HEATMAP_TOP) ?? [],
  );
  protected readonly usageInfo = computed(() =>
    this.data()?.skillsOverTime.mode === 'selected'
      ? `${USAGE_INFO} Shows the skills chosen by the site owner that match the view.`
      : `${USAGE_INFO} Shows the most used skills of the view.`,
  );
  protected readonly usageOption = computed(() => {
    const data = this.data();
    return data ? skillUsageOption(data.skillsOverTime, this.palette()) : null;
  });
  protected readonly heatmapOption = computed(() => {
    const data = this.data();
    return data ? heatmapOption(data.skillUsage, this.palette(), HEATMAP_TOP) : null;
  });

  protected readonly gauge = computed<GaugeGroup[]>(() =>
    (this.data()?.skillTotals ?? []).map((group) => ({
      label: group.category,
      items: group.skills.map((s) => ({
        label: s.name,
        value: s.years,
        display: `${s.years} yrs`,
        note: s.level ? `level ${s.level}/5` : null,
      })),
    })),
  );

  protected setYear(key: 'from' | 'to', value: string): void {
    const view = { ...this.view(), [key]: Number(value) };
    // Keep the range valid: moving one end past the other moves both.
    if (view.from !== undefined && view.to !== undefined && view.from > view.to) {
      if (key === 'from') view.to = view.from;
      else view.from = view.to;
    }
    this.navigate(view);
  }

  protected setFilter(key: 'category' | 'skill', value: string): void {
    this.navigate({ ...this.view(), [key]: value || undefined });
  }

  protected reset(): void {
    this.navigate({});
  }

  private navigate(query: DashboardQuery): void {
    this.rememberFocus();
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(query) });
  }

  private rememberFocus(): void {
    const active = this.document.activeElement;
    this.focusToRestore =
      active instanceof HTMLElement && active !== this.document.body ? active : null;
  }
}
