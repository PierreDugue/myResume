import type { DashboardQuery, DashboardResponse } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { renderRoute, type } from '../../admin/testing/render';
import { DashboardApi } from '../../core/dashboard/dashboard-api.service';
import { $ } from '../../testing';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { OverviewPage } from './overview-page';
import { dashboardFixture } from './testing/dashboard-fixture';

describe('OverviewPage (Career Overview)', () => {
  let respond: (q: DashboardQuery) => Observable<DashboardResponse>;
  const get = vi.fn((q: DashboardQuery) => respond(q));
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };

  const render = (url = '/') =>
    renderRoute(
      url,
      [{ path: '', component: OverviewPage }],
      [
        { provide: DashboardApi, useValue: { get } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
      ],
    );

  beforeEach(() => {
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
    expect(table.querySelector('tbody tr')?.textContent).toContain('Angular');
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
});
