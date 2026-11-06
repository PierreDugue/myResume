import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import type { ProcessMetricsHistory } from '@my-resume/api-models';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { renderRoute } from '../../admin/testing/render';
import { LiveService } from '../../core/live/live.service';
import { FakeLive } from '../../core/live/testing/fake-live';
import { SiteMetricsApi } from '../../core/site-metrics/site-metrics-api.service';
import { PageVisibility } from '../../core/visibility/page-visibility.service';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { $ } from '../../testing';
import { SiteMetricsPage } from './site-metrics-page';
import { historyOf, sampleAt, samplesBetween } from './testing/process-fixture';

@Component({ template: 'elsewhere' })
class Elsewhere {}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();

/** Ten samples, the latest one (second 9) with values that tell the stats apart. */
function tenSeconds(): ProcessMetricsHistory {
  const samples = samplesBetween(0, 8);
  samples.push(
    sampleAt(9, {
      uptimeSeconds: 5025,
      eventLoopLagMs: { p50: 1.5, p99: 12.25 },
      memoryMb: { rss: 150.2, heapTotal: 80, heapUsed: 55.5 },
      cpuPercent: 7.5,
      gc: { minorCount: 3, minorMs: 2, majorCount: 1, majorMs: 6 },
    }),
  );
  return historyOf(samples);
}

describe('SiteMetricsPage', () => {
  let live: FakeLive;
  let visible$: BehaviorSubject<boolean>;
  let answers: () => Observable<ProcessMetricsHistory>;
  const processHistory = vi.fn((since?: string) => {
    void since;
    return answers();
  });
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() };

  const render = (url = '/dashboards/meta') =>
    renderRoute(
      url,
      [
        { path: 'dashboards/meta', component: SiteMetricsPage },
        { path: '**', component: Elsewhere },
      ],
      [
        { provide: LiveService, useValue: live },
        { provide: SiteMetricsApi, useValue: { processHistory } },
        { provide: PageVisibility, useValue: { visible$: visible$.asObservable() } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
      ],
    );

  /** Delivers the live subscription's history, as the server's ack would. */
  async function ackHistory(
    settle: () => Promise<void>,
    history: ProcessMetricsHistory = tenSeconds(),
  ) {
    live.calls[0].stream.next({ kind: 'history', history });
    await settle();
  }

  const panel = (el: HTMLElement, title: string) => {
    const found = [...el.querySelectorAll('app-panel')].find(
      (p) => text(p.querySelector('h2')) === title,
    );
    if (!found) throw new Error(`No panel titled "${title}"`);
    return found as HTMLElement;
  };
  const pickerButton = (el: HTMLElement, name: string) => {
    const found = [...el.querySelectorAll<HTMLButtonElement>('app-refresh-picker button')].find(
      (b) => text(b) === name,
    );
    if (!found) throw new Error(`No refresh button "${name}"`);
    return found;
  };
  const menuItem = async (
    root: HTMLElement,
    settle: () => Promise<void>,
    name: string,
  ): Promise<void> => {
    $<HTMLButtonElement>(root, 'button[aria-haspopup="menu"]').click();
    await settle();
    [...root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.includes(name))
      ?.click();
    await settle();
  };

  beforeEach(() => {
    live = new FakeLive();
    visible$ = new BehaviorSubject(true);
    answers = () => of(tenSeconds());
    processHistory.mockClear();
    chart.setOption.mockClear();
  });

  describe('live mode (the default)', () => {
    it('subscribes to the live feed, shows a loading state, and has no title of its own', async () => {
      const { el } = await render();
      expect(live.metrics).toHaveBeenCalledOnce();
      expect(processHistory).not.toHaveBeenCalled();
      expect(text($(el, '.loading'))).toContain('Loading');
      // Only the inspector shows while loading: no stat or chart panel yet.
      expect(el.querySelector('app-stat-panel, app-echart')).toBeNull();
      expect([...el.querySelectorAll('app-panel h2')].map((h) => text(h))).toEqual([
        'Stream inspector',
      ]);
      // The title and the breadcrumb h1 come from the route.
      expect(el.querySelector('h1')).toBeNull();
    });

    it('has the refresh picker on Live and the badge in the toolbar', async () => {
      const { el, settle } = await render();
      expect(pickerButton(el, 'Live').getAttribute('aria-pressed')).toBe('true');
      expect(pickerButton(el, 'Off').getAttribute('aria-pressed')).toBe('false');
      expect(text($(el, 'app-live-badge'))).toBe('Connecting…');

      live.setStatus('connected');
      await settle();
      expect(text($(el, 'app-live-badge'))).toBe('LIVE');
    });

    it('shows the six stats once the history arrives', async () => {
      const { el, settle } = await render();
      await ackHistory(settle);
      const stats = [...el.querySelectorAll('app-stat-panel')].map((s) => [
        text(s.querySelector('.label')),
        text(s.querySelector('.value')),
        text(s.querySelector('.hint')),
      ]);
      expect(stats).toEqual([
        ['Uptime', '1 h 23 min', 'since the backend started'],
        ['Event loop lag (p99)', '12.25 ms', 'p50 1.5 ms'],
        ['Heap used', '55.5 MB', 'of 80 MB'],
        ['RSS', '150.2 MB', 'memory held by the process'],
        ['CPU', '7.5 %', 'of one core'],
        ['GC pauses, last minute', '4', '8 ms paused'],
      ]);
      expect(el.querySelector('.loading')).toBeNull();
    });

    it('draws the four charts, each in a panel, without animation', async () => {
      const { el, settle } = await render();
      await ackHistory(settle);
      for (const title of ['Event loop lag', 'Memory', 'CPU', 'Garbage collection']) {
        const chartBox = panel(el, title).querySelector('app-echart [role="img"]');
        expect(chartBox?.getAttribute('aria-label')).toBeTruthy();
      }
      expect(chart.setOption).toHaveBeenCalled();
      // Merged, so the legend selection survives the update each second.
      expect(chart.setOption).toHaveBeenLastCalledWith(
        expect.objectContaining({ animation: false }),
        { notMerge: false },
      );
    });

    it('adds each tick to the stats', async () => {
      const { el, settle } = await render();
      await ackHistory(settle);
      live.calls[0].stream.next({
        kind: 'tick',
        sample: sampleAt(10, { cpuPercent: 42.5, eventLoopLagMs: { p50: 2, p99: 30 } }),
      });
      await settle();
      const value = (label: string) =>
        text(
          [...el.querySelectorAll('app-stat-panel')]
            .find((s) => text(s.querySelector('.label')) === label)
            ?.querySelector('.value'),
        );
      expect(value('CPU')).toBe('42.5 %');
      expect(value('Event loop lag (p99)')).toBe('30 ms');
    });

    it('offers every chart as a table, newest sample first', async () => {
      const { el, settle } = await render();
      await ackHistory(settle);
      const memory = panel(el, 'Memory');
      expect(memory.querySelector('table')).toBeNull();
      await menuItem(memory, settle, 'Show as table');

      const headers = [...memory.querySelectorAll('thead th')].map((h) => text(h));
      expect(headers).toEqual(['Time (UTC)', 'RSS (MB)', 'Heap total (MB)', 'Heap used (MB)']);
      const rows = [...memory.querySelectorAll('tbody tr')].map((r) =>
        [...r.children].map((cell) => text(cell)).join(' '),
      );
      expect(rows).toHaveLength(10);
      expect(rows[0]).toBe('14:00:09 150.2 80 55.5');
      expect(rows[9]).toBe('14:00:00 100 60 40');
      expect(memory.querySelector('app-echart')).toBeNull();
      expect(memory.querySelector('table caption')?.textContent).toContain('Memory');

      await menuItem(memory, settle, 'Show chart');
      expect(memory.querySelector('table')).toBeNull();
    });

    it.each([
      ['Event loop lag', ['Time (UTC)', 'p50 (ms)', 'p99 (ms)']],
      ['CPU', ['Time (UTC)', 'CPU (% of one core)']],
      [
        'Garbage collection',
        ['Time (UTC)', 'Minor (count)', 'Minor (ms)', 'Major (count)', 'Major (ms)'],
      ],
    ])('has a table alternative for "%s"', async (title, columns) => {
      const { el, settle } = await render();
      await ackHistory(settle);
      await menuItem(panel(el, title), settle, 'Show as table');
      expect([...panel(el, title).querySelectorAll('thead th')].map((h) => text(h))).toEqual(
        columns,
      );
    });

    it('lets visitors inspect the samples behind a chart', async () => {
      const { el, settle } = await render();
      await ackHistory(settle);
      await menuItem(panel(el, 'CPU'), settle, 'Inspect data');
      expect($(el, '[role="dialog"]').textContent).toContain('"cpuPercent": 7.5');
    });

    it('lists the stream in the inspector, newest first', async () => {
      const { el, settle } = await render();
      live.calls[0].stream.next({ kind: 'sent', event: 'subscribe:metrics', payload: {} });
      await ackHistory(settle);
      live.calls[0].stream.next({ kind: 'tick', sample: sampleAt(10) });
      await settle();

      const inspector = panel(el, 'Stream inspector');
      const rows = [...inspector.querySelectorAll('li')].map((li) => text(li));
      expect(rows).toHaveLength(3);
      expect(rows[0]).toContain('metrics:tick');
      expect(rows[1]).toContain('subscribe:metrics (ack)');
      expect(rows[1]).toContain('history: 10 samples, 14:00:00 → 14:00:09');
      expect(rows[2]).toContain('sent subscribe:metrics {}');
      expect(inspector.querySelector('[aria-live]')).toBeNull();
      expect(
        panel(el, 'Stream inspector').querySelector('[role="note"]')?.getAttribute('aria-label'),
      ).toContain('sent');
    });

    it('shows an empty state when the backend has no samples yet', async () => {
      const { el, settle } = await render();
      await ackHistory(settle, historyOf([]));
      expect(text($(el, '.empty-state'))).toContain('No samples yet');
      expect(el.querySelector('app-stat-panel')).toBeNull();
      expect(el.querySelector('app-live-badge')).not.toBeNull();
    });

    it('leaves the live feed when the visitor leaves the page', async () => {
      const { router, settle } = await render();
      expect(live.activeCalls).toBe(1);
      await router.navigateByUrl('/elsewhere');
      await settle();
      expect(live.activeCalls).toBe(0);
    });

    it('falls back to polling over HTTP when the live subscription is refused', async () => {
      const { el, settle } = await render();
      const { LiveSubscribeError } = await import('../../core/live/live.service');
      live.calls[0].stream.error(new LiveSubscribeError('page_disabled', 'disabled'));
      await settle();
      expect(processHistory).toHaveBeenCalledOnce();
      expect(text($(el, 'app-live-badge'))).toBe('Live unavailable · polling every 5s');
      expect(el.querySelector('app-stat-panel')).not.toBeNull();
    });

    it('says "Paused (tab hidden)" while the tab is hidden', async () => {
      const { el, settle } = await render();
      visible$.next(false);
      await settle();
      expect(text($(el, 'app-live-badge'))).toBe('Paused (tab hidden)');
      expect(live.activeCalls).toBe(0);
    });
  });

  describe('the refresh mode in the URL', () => {
    it('reads ?refresh=5s: polls instead of subscribing, and the picker shows it', async () => {
      const { el } = await render('/dashboards/meta?refresh=5s');
      expect(live.metrics).not.toHaveBeenCalled();
      expect(processHistory).toHaveBeenCalledOnce();
      expect(pickerButton(el, '5s').getAttribute('aria-pressed')).toBe('true');
      expect(text($(el, 'app-live-badge'))).toBe('Polling every 5s');
      expect(el.querySelectorAll('app-stat-panel')).toHaveLength(6);
    });

    it('ignores an unknown value and uses live', async () => {
      const { el } = await render('/dashboards/meta?refresh=banana');
      expect(live.metrics).toHaveBeenCalledOnce();
      expect(pickerButton(el, 'Live').getAttribute('aria-pressed')).toBe('true');
    });

    it('writes the choice to the URL, and leaves live out (it is the default)', async () => {
      const { el, router, settle } = await render();
      pickerButton(el, '30s').click();
      await settle();
      expect(router.url).toBe('/dashboards/meta?refresh=30s');
      expect(pickerButton(el, '30s').getAttribute('aria-pressed')).toBe('true');
      expect(text($(el, 'app-live-badge'))).toBe('Polling every 30s');
      expect(live.activeCalls).toBe(0);

      pickerButton(el, 'Live').click();
      await settle();
      expect(router.url).toBe('/dashboards/meta');
      expect(live.activeCalls).toBe(1);
    });

    it('keeps the other query parameters when it changes the refresh mode', async () => {
      const { el, router, settle } = await render('/dashboards/meta?utm=x');
      pickerButton(el, 'Off').click();
      await settle();
      expect(router.url).toBe('/dashboards/meta?utm=x&refresh=off');
    });

    it('loads once and says "Off" for ?refresh=off', async () => {
      const { el } = await render('/dashboards/meta?refresh=off');
      expect(processHistory).toHaveBeenCalledOnce();
      expect(text($(el, 'app-live-badge'))).toBe('Off');
    });
  });

  describe('when the first load fails', () => {
    const failure = () => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' });

    it('explains it and offers to try again', async () => {
      answers = () => throwError(failure);
      const { el, settle } = await render('/dashboards/meta?refresh=off');
      expect($(el, '[role="alert"]').textContent).toContain('could not be loaded');
      expect(el.querySelector('app-stat-panel')).toBeNull();
      // The toolbar and the inspector stay, so the failure can be followed.
      expect(el.querySelector('app-refresh-picker')).not.toBeNull();
      expect(text(panel(el, 'Stream inspector'))).toContain('HTTP 503');

      answers = () => of(tenSeconds());
      $<HTMLButtonElement>(el, 'button.retry').click();
      await settle();
      expect(processHistory).toHaveBeenCalledTimes(2);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.querySelectorAll('app-stat-panel')).toHaveLength(6);
    });

    it('shows the loading state while the retry is in flight', async () => {
      answers = () => throwError(failure);
      const { el, settle } = await render('/dashboards/meta?refresh=off');
      answers = () => new Subject<ProcessMetricsHistory>();
      $<HTMLButtonElement>(el, 'button.retry').click();
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(text($(el, '.loading'))).toContain('Loading');
    });
  });
});
