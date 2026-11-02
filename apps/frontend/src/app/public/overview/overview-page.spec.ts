import type { DashboardQuery, DashboardResponse } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { renderRoute, type } from '../../admin/testing/render';
import { DashboardApi } from '../../core/dashboard/dashboard-api.service';
import { fakePageAccess } from '../../layout/testing/fake-page-access';
import type { PublicPageId } from '@my-resume/api-models';
import { $ } from '../../testing';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { OverviewPage } from './overview-page';
import { dashboardFixture } from './testing/dashboard-fixture';

describe('OverviewPage (Career Overview)', () => {
  let respond: (q: DashboardQuery) => Observable<DashboardResponse>;
  const get = vi.fn((q: DashboardQuery) => respond(q));
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };

  let disabled: PublicPageId[] = [];
  const render = (url = '/') =>
    renderRoute(
      url,
      [{ path: '', component: OverviewPage }],
      [
        { provide: DashboardApi, useValue: { get } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
        fakePageAccess(disabled),
      ],
    );

  beforeEach(() => {
    disabled = [];
    respond = () => of(dashboardFixture());
    get.mockClear();
  });

  const select = (el: HTMLElement, label: string) => {
    const l = [...el.querySelectorAll('label')].find((x) => x.textContent?.trim() === label);
    return $<HTMLSelectElement>(el, `#${l?.getAttribute('for')}`);
  };

  it('loads the dashboard for the range and filters in the URL', async () => {
    await render('/?from=2017&to=2020&skill=angular');
    expect(get).toHaveBeenCalledWith({ from: 2017, to: 2020, skill: 'angular' });
  });

  it('shows the stats, profile, timeline, impacts and latest highlights', async () => {
    const { el } = await render();
    expect(
      [...el.querySelectorAll('app-stat-panel .value')].map((v) => v.textContent?.trim()),
    ).toEqual(['14+', '9+', 'since 2011', '3', '2', '3']);
    expect(el.textContent).toContain('Pierre Dugue');
    expect(el.querySelectorAll('app-career-timeline li.item')).toHaveLength(4);
    expect(el.querySelectorAll('app-impact-list li.impact')).toHaveLength(2);
    expect(el.querySelectorAll('app-log-preview li')).toHaveLength(2);
    expect(el.querySelectorAll('app-echart')).toHaveLength(2);
  });

  it('offers the years and filters from the response', async () => {
    const { el } = await render();
    const from = select(el, 'From');
    expect([...from.options].map((o) => o.value)).toEqual(
      [...Array(19)].map((_, i) => String(2008 + i)),
    );
    expect(from.value).toBe('2011');
    expect([...select(el, 'Category').options].map((o) => o.textContent?.trim())).toEqual([
      'All categories',
      'Core',
      'State',
    ]);
    expect([...select(el, 'Skill').options].map((o) => o.textContent?.trim())).toEqual([
      'All skills',
      'Angular',
      'NgRx',
    ]);
  });

  it('writes a new range or filter into the URL, which reloads the panels', async () => {
    const { el, router, settle } = await render();
    type(select(el, 'From'), '2020');
    await settle();
    expect(router.url).toBe('/?from=2020&to=2026');
    expect(get).toHaveBeenLastCalledWith({ from: 2020, to: 2026 });

    type(select(el, 'Skill'), 'ngrx');
    await settle();
    expect(router.url).toBe('/?from=2020&to=2026&skill=ngrx');
  });

  it('resets the view to the whole career', async () => {
    const { el, router, settle } = await render('/?from=2020&skill=ngrx');
    $<HTMLButtonElement>(el, 'button.reset').click();
    await settle();
    expect(router.url).toBe('/');
  });

  it('can show the skills-over-time chart as a table', async () => {
    const { el, settle } = await render();
    const panel = [...el.querySelectorAll('app-panel')].find((p) =>
      p.querySelector('h2')?.textContent?.includes('Skills over time'),
    ) as HTMLElement;
    $<HTMLButtonElement>(panel, 'button.panel-menu-toggle').click();
    await settle();
    [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.trim() === 'Show as table')
      ?.click();
    await settle();
    const table = $(panel, 'table');
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      'Skill',
      '2024',
      '2025',
      '2026',
    ]);
    // skillsOverTime (NgRx only), not skillUsage (Angular, NgRx)
    expect([...table.querySelectorAll('tbody th')].map((th) => th.textContent?.trim())).toEqual([
      'NgRx',
    ]);
  });

  const panelOf = (el: HTMLElement, title: string) =>
    [...el.querySelectorAll('app-panel')].find((p) =>
      p.querySelector('h2')?.textContent?.includes(title),
    ) as HTMLElement;

  it('draws the lines of skillsOverTime, not those of skillUsage', async () => {
    chart.setOption.mockClear();
    await render();
    const options = chart.setOption.mock.calls.map(
      ([o]) => o as { series: { type: string; name: string }[] },
    );
    const lines = options.find((o) => o.series.every((s) => s.type === 'line'));
    expect(lines?.series.map((s) => s.name)).toEqual(['NgRx']);
  });

  it('keeps the heatmap on skillUsage', async () => {
    const { el, settle } = await render();
    const panel = panelOf(el, 'Technologies per year');
    $<HTMLButtonElement>(panel, 'button.panel-menu-toggle').click();
    await settle();
    [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.trim() === 'Show as table')
      ?.click();
    await settle();
    expect([...panel.querySelectorAll('tbody th')].map((th) => th.textContent?.trim())).toEqual([
      'Angular',
      'NgRx',
    ]);
  });

  it('inspects the data of skillsOverTime for the line chart panel', async () => {
    const { el, settle } = await render();
    const panel = panelOf(el, 'Skills over time');
    $<HTMLButtonElement>(panel, 'button.panel-menu-toggle').click();
    await settle();
    [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.trim() === 'Inspect data')
      ?.click();
    await settle();
    const json = panel.querySelector('[role="dialog"] pre')?.textContent ?? '';
    expect(json).toContain('"mode": "selected"');
    expect(json).not.toContain('"Angular"');
  });

  const tooltip = (el: HTMLElement) =>
    panelOf(el, 'Skills over time').querySelector('.info')?.getAttribute('data-tip') ?? '';

  it('says in the info tooltip that the chart shows the skills chosen by the site owner', async () => {
    const { el } = await render();
    expect(tooltip(el)).toContain('chosen by the site owner');
    expect(tooltip(el)).not.toContain('most used');
  });

  it('says in the info tooltip that the chart shows the most used skills when automatic', async () => {
    respond = () => {
      const data = dashboardFixture();
      return of({ ...data, skillsOverTime: { ...data.skillsOverTime, mode: 'auto' as const } });
    };
    const { el } = await render();
    expect(tooltip(el)).toContain('most used skills');
    expect(tooltip(el)).not.toContain('site owner');
  });

  it('shows an error with a retry button', async () => {
    let calls = 0;
    respond = () => (calls++ === 0 ? throwError(() => new Error('down')) : of(dashboardFixture()));
    const { el, settle } = await render();
    expect($(el, '[role="alert"]').textContent).toContain('could not be loaded');
    $<HTMLButtonElement>(el, 'button.retry').click();
    await settle();
    expect(el.textContent).toContain('Pierre Dugue');
  });

  it('links the latest highlights to Explore, unless the viewer cannot see Explore', async () => {
    const { el } = await render();
    expect(el.querySelector('app-log-preview a.explore')).not.toBeNull();
  });

  it('leaves out the Explore link when Explore is hidden from the viewer', async () => {
    disabled = ['explore'];
    const { el } = await render();
    expect(el.querySelectorAll('app-log-preview li')).toHaveLength(2);
    expect(el.querySelector('app-log-preview a.explore')).toBeNull();
  });
});
