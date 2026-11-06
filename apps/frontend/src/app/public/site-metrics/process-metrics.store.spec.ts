import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ProcessMetricsHistory } from '@my-resume/api-models';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { LiveService, LiveSubscribeError } from '../../core/live/live.service';
import { FakeLive } from '../../core/live/testing/fake-live';
import { SiteMetricsApi } from '../../core/site-metrics/site-metrics-api.service';
import { PageVisibility } from '../../core/visibility/page-visibility.service';
import type { RefreshMode } from '../../shared/refresh/refresh-mode';
import { ProcessMetricsStore } from './process-metrics.store';
import { historyOf, sampleAt, samplesBetween, tsAt } from './testing/process-fixture';

describe('ProcessMetricsStore', () => {
  let live: FakeLive;
  let mode$: BehaviorSubject<RefreshMode>;
  let visible$: BehaviorSubject<boolean>;
  let answers: (since?: string) => Observable<ProcessMetricsHistory>;
  const processHistory = vi.fn((since?: string) => answers(since));
  let store: ProcessMetricsStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 14, 0, 0, 0));
    live = new FakeLive();
    mode$ = new BehaviorSubject<RefreshMode>('live');
    visible$ = new BehaviorSubject(true);
    answers = () => of(historyOf([]));
    processHistory.mockClear();
    TestBed.configureTestingModule({
      providers: [
        ProcessMetricsStore,
        { provide: LiveService, useValue: live },
        { provide: SiteMetricsApi, useValue: { processHistory } },
        { provide: PageVisibility, useValue: { visible$: visible$.asObservable() } },
      ],
    });
    store = TestBed.inject(ProcessMetricsStore);
  });

  afterEach(() => vi.useRealTimers());

  /** Starts following `mode$` and lets effects run. */
  function start(): void {
    store.follow(mode$);
    TestBed.tick();
  }

  const lastCall = () => live.calls[live.calls.length - 1];
  const times = (samples: { ts: string }[]) =>
    samples.map((s) => (Date.parse(s.ts) - Date.parse(tsAt(0))) / 1000);

  describe('live mode', () => {
    it('is loading, with no samples, before anything arrives', () => {
      start();
      expect(store.loading()).toBe(true);
      expect(store.samples()).toEqual([]);
      expect(store.error()).toBeNull();
      expect(live.activeCalls).toBe(1);
      expect(processHistory).not.toHaveBeenCalled();
    });

    it('shows the history of the subscribe ack, with when the backend started', () => {
      start();
      lastCall().stream.next({
        kind: 'history',
        history: historyOf(samplesBetween(0, 4), tsAt(-100)),
      });
      expect(times(store.samples())).toEqual([0, 1, 2, 3, 4]);
      expect(store.startedAt()).toBe(tsAt(-100));
      expect(store.loading()).toBe(false);
    });

    it('adds every tick, merged by ts: a tick around the ack is neither lost nor doubled', () => {
      start();
      const { stream } = lastCall();
      stream.next({ kind: 'tick', sample: sampleAt(3) });
      stream.next({ kind: 'history', history: historyOf(samplesBetween(0, 3)) });
      stream.next({ kind: 'tick', sample: sampleAt(4) });
      stream.next({ kind: 'tick', sample: sampleAt(4) });
      expect(times(store.samples())).toEqual([0, 1, 2, 3, 4]);
    });

    it('keeps the newest 300 samples', () => {
      start();
      lastCall().stream.next({ kind: 'history', history: historyOf(samplesBetween(0, 299)) });
      lastCall().stream.next({ kind: 'tick', sample: sampleAt(300) });
      expect(store.samples()).toHaveLength(300);
      expect(times(store.samples())[0]).toBe(1);
    });

    it('asks for the samples after the last one it has, each time it (re)subscribes', () => {
      start();
      const { since, stream } = lastCall();
      expect(since()).toBeUndefined();
      stream.next({ kind: 'history', history: historyOf(samplesBetween(0, 9)) });
      expect(since()).toBe(tsAt(9));
      stream.next({ kind: 'tick', sample: sampleAt(10) });
      expect(since()).toBe(tsAt(10));
    });

    it.each([
      ['idle', 'connecting'],
      ['connecting', 'connecting'],
      ['connected', 'live'],
      ['reconnecting', 'reconnecting'],
    ] as const)('shows the badge state for a %s socket as "%s"', (socket, feed) => {
      start();
      live.setStatus(socket);
      expect(store.feedStatus()).toBe(feed);
    });

    it('does not poll over HTTP while the socket is up', () => {
      start();
      live.setStatus('connected');
      vi.advanceTimersByTime(60_000);
      expect(processHistory).not.toHaveBeenCalled();
    });
  });

  describe('live mode: HTTP fallback', () => {
    it('polls every 5 seconds while the socket is offline, the first call at once', () => {
      start();
      lastCall().stream.next({ kind: 'history', history: historyOf(samplesBetween(0, 9)) });
      answers = (since) => of(historyOf(since ? [sampleAt(11)] : []));

      live.setStatus('offline');
      expect(store.feedStatus()).toBe('offline');
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(processHistory).toHaveBeenLastCalledWith(tsAt(9));
      expect(times(store.samples())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);

      vi.advanceTimersByTime(4_999);
      expect(processHistory).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(processHistory).toHaveBeenCalledTimes(2);
      expect(processHistory).toHaveBeenLastCalledWith(tsAt(11));
    });

    it('stops polling once the socket is connected again', () => {
      start();
      live.setStatus('offline');
      expect(processHistory).toHaveBeenCalledTimes(1);
      live.setStatus('connected');
      expect(store.feedStatus()).toBe('live');
      vi.advanceTimersByTime(60_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
    });

    it('polls when the server refuses the subscription (the page is disabled for sockets)', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('page_disabled', 'Page disabled'));
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(store.feedStatus()).toBe('fallback');
      vi.advanceTimersByTime(5_000);
      expect(processHistory).toHaveBeenCalledTimes(2);
    });

    it('polls when the subscription fails for another reason, such as a timeout', () => {
      start();
      lastCall().stream.error(new Error('operation has timed out'));
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(store.feedStatus()).toBe('fallback');
    });

    it('does not start a call while the previous one is still in flight', () => {
      start();
      const pending = new Subject<ProcessMetricsHistory>();
      answers = () => pending;
      live.setStatus('offline');
      vi.advanceTimersByTime(30_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
      pending.next(historyOf([sampleAt(1)]));
      pending.complete();
      vi.advanceTimersByTime(5_000);
      expect(processHistory).toHaveBeenCalledTimes(2);
    });
  });

  describe('live mode: trying the socket again', () => {
    const connectedHistory = () => ({
      kind: 'history' as const,
      history: historyOf(samplesBetween(0, 2)),
    });

    it('subscribes again after a timeout, and is live again (no polling) on the next history', () => {
      start();
      lastCall().stream.error(new Error('operation has timed out'));
      expect(store.feedStatus()).toBe('fallback');
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(live.calls).toHaveLength(1);

      vi.advanceTimersByTime(4_999);
      expect(live.calls).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(live.calls).toHaveLength(2);
      expect(live.activeCalls).toBe(1);

      live.setStatus('connected');
      lastCall().stream.next(connectedHistory());
      expect(store.feedStatus()).toBe('live');
      const polls = processHistory.mock.calls.length;
      vi.advanceTimersByTime(60_000);
      expect(processHistory).toHaveBeenCalledTimes(polls);
      expect(live.calls).toHaveLength(2);
    });

    it('keeps polling every 5 seconds until the stream is back', () => {
      start();
      lastCall().stream.error(new Error('operation has timed out'));
      expect(processHistory).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(5_000);
      expect(processHistory).toHaveBeenCalledTimes(2);
      expect(store.feedStatus()).toBe('fallback');
    });

    it('recovers from a failed import of the socket client (a stale chunk after a deploy)', () => {
      start();
      lastCall().stream.error(new TypeError('Failed to fetch dynamically imported module'));
      expect(store.feedStatus()).toBe('fallback');
      vi.advanceTimersByTime(5_000);
      lastCall().stream.next(connectedHistory());
      live.setStatus('connected');
      expect(store.feedStatus()).toBe('live');
    });

    it('also tries again after rate_limited', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('rate_limited', 'Too many'));
      vi.advanceTimersByTime(5_000);
      expect(live.calls).toHaveLength(2);
    });

    it('backs off 5, 10, 20 s, then every 30 s at most', () => {
      start();
      for (const wait of [5_000, 10_000, 20_000, 30_000, 30_000]) {
        const calls = live.calls.length;
        lastCall().stream.error(new Error('no answer'));
        vi.advanceTimersByTime(wait - 1);
        expect(live.calls).toHaveLength(calls);
        vi.advanceTimersByTime(1);
        expect(live.calls).toHaveLength(calls + 1);
      }
    });

    it('starts the backoff over once a history arrived', () => {
      start();
      lastCall().stream.error(new Error('no answer'));
      vi.advanceTimersByTime(5_000);
      lastCall().stream.error(new Error('no answer'));
      vi.advanceTimersByTime(10_000);
      lastCall().stream.next(connectedHistory());

      const calls = live.calls.length;
      lastCall().stream.error(new Error('dropped'));
      vi.advanceTimersByTime(5_000);
      expect(live.calls).toHaveLength(calls + 1);
    });

    it('does not try again when the page is disabled for sockets, but keeps polling', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('page_disabled', 'Page disabled'));
      vi.advanceTimersByTime(10 * 60_000);
      expect(live.calls).toHaveLength(1);
      expect(store.feedStatus()).toBe('fallback');
      expect(processHistory.mock.calls.length).toBeGreaterThan(100);
    });

    it('tries the socket again for page_disabled when the mode changes', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('page_disabled', 'Page disabled'));
      mode$.next('5s');
      mode$.next('live');
      expect(live.calls).toHaveLength(2);
      expect(store.feedStatus()).toBe('connecting');
    });

    it('tries the socket again for page_disabled when the tab is shown again', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('page_disabled', 'Page disabled'));
      visible$.next(false);
      visible$.next(true);
      expect(live.calls).toHaveLength(2);
    });

    it('stops trying when the mode changes', () => {
      start();
      lastCall().stream.error(new Error('no answer'));
      mode$.next('5s');
      vi.advanceTimersByTime(60_000);
      expect(live.calls).toHaveLength(1);
    });
  });

  describe('polling modes', () => {
    it.each([
      ['5s', 5_000, 'poll-5s'],
      ['30s', 30_000, 'poll-30s'],
      ['1m', 60_000, 'poll-1m'],
    ] as const)('mode %s polls at once, then every %i ms', (mode, interval, feed) => {
      mode$.next(mode);
      start();
      expect(live.metrics).not.toHaveBeenCalled();
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(store.feedStatus()).toBe(feed);

      vi.advanceTimersByTime(interval - 1);
      expect(processHistory).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(processHistory).toHaveBeenCalledTimes(2);
    });

    it('asks only for what is new: since is the ts of the last sample', () => {
      mode$.next('5s');
      answers = (since) => of(historyOf(since ? samplesBetween(11, 12) : samplesBetween(0, 10)));
      start();
      expect(processHistory).toHaveBeenLastCalledWith(undefined);
      vi.advanceTimersByTime(5_000);
      expect(processHistory).toHaveBeenLastCalledWith(tsAt(10));
      expect(times(store.samples())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('shows the history and when the backend started', () => {
      mode$.next('30s');
      answers = () => of(historyOf(samplesBetween(0, 2), tsAt(-50)));
      start();
      expect(times(store.samples())).toEqual([0, 1, 2]);
      expect(store.startedAt()).toBe(tsAt(-50));
      expect(store.loading()).toBe(false);
    });

    it('keeps the series going when the backend restarted (new startedAt, later samples)', () => {
      mode$.next('5s');
      const first = historyOf([sampleAt(1, { uptimeSeconds: 900 })], tsAt(-900));
      const second = historyOf([sampleAt(7, { uptimeSeconds: 2 })], tsAt(5));
      answers = (since) => of(since ? second : first);
      start();
      vi.advanceTimersByTime(5_000);
      expect(times(store.samples())).toEqual([1, 7]);
      expect(store.startedAt()).toBe(tsAt(5));
    });

    it('closes the live stream when the mode changes from live to a polling mode', () => {
      start();
      expect(live.activeCalls).toBe(1);
      mode$.next('5s');
      expect(live.activeCalls).toBe(0);
      expect(processHistory).toHaveBeenCalledTimes(1);
    });

    it('stops polling when the mode changes back to live', () => {
      mode$.next('5s');
      start();
      mode$.next('live');
      vi.advanceTimersByTime(60_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(live.activeCalls).toBe(1);
    });

    it('subscribes with the samples it already has when switching to live', () => {
      mode$.next('5s');
      answers = () => of(historyOf(samplesBetween(0, 20)));
      start();
      mode$.next('live');
      expect(lastCall().since()).toBe(tsAt(20));
    });
  });

  describe('off', () => {
    it('loads once and then does nothing', () => {
      mode$.next('off');
      answers = () => of(historyOf(samplesBetween(0, 2)));
      start();
      expect(processHistory).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(10 * 60_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(live.metrics).not.toHaveBeenCalled();
      expect(store.feedStatus()).toBe('off');
      expect(times(store.samples())).toEqual([0, 1, 2]);
    });

    it('does not load again when the tab is hidden and shown', () => {
      mode$.next('off');
      start();
      visible$.next(false);
      visible$.next(true);
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(store.feedStatus()).toBe('off');
    });
  });

  describe('hidden tab', () => {
    it('stops the live stream and says "paused", then resumes from the last sample', () => {
      start();
      lastCall().stream.next({ kind: 'history', history: historyOf(samplesBetween(0, 9)) });

      visible$.next(false);
      expect(live.activeCalls).toBe(0);
      expect(store.feedStatus()).toBe('paused');

      visible$.next(true);
      expect(live.activeCalls).toBe(1);
      expect(lastCall().since()).toBe(tsAt(9));
    });

    it('stops polling while hidden, and polls at once on return', () => {
      mode$.next('5s');
      start();
      expect(processHistory).toHaveBeenCalledTimes(1);

      visible$.next(false);
      vi.advanceTimersByTime(10 * 60_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
      expect(store.feedStatus()).toBe('paused');

      visible$.next(true);
      expect(processHistory).toHaveBeenCalledTimes(2);
    });

    it('stops the HTTP fallback too', () => {
      start();
      live.setStatus('offline');
      expect(processHistory).toHaveBeenCalledTimes(1);
      visible$.next(false);
      vi.advanceTimersByTime(60_000);
      expect(processHistory).toHaveBeenCalledTimes(1);
    });

    it('starts paused when the tab starts hidden', () => {
      visible$.next(false);
      start();
      expect(live.metrics).not.toHaveBeenCalled();
      expect(store.feedStatus()).toBe('paused');
    });
  });

  describe('loading and errors', () => {
    const failure = () => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' });

    it('reports an error when the first load fails, and stops loading', () => {
      mode$.next('5s');
      answers = () => throwError(failure);
      start();
      expect(store.error()).toBeInstanceOf(HttpErrorResponse);
      expect(store.loading()).toBe(false);
      expect(store.samples()).toEqual([]);
    });

    it('retries from scratch, and clears the error when it works', () => {
      mode$.next('off');
      answers = () => throwError(failure);
      start();
      expect(store.error()).not.toBeNull();

      answers = () => of(historyOf(samplesBetween(0, 1)));
      store.retry();
      expect(store.error()).toBeNull();
      expect(times(store.samples())).toEqual([0, 1]);
      expect(store.loading()).toBe(false);
    });

    it('is loading again while a retry is in flight', () => {
      mode$.next('off');
      answers = () => throwError(failure);
      start();
      answers = () => new Subject<ProcessMetricsHistory>();
      store.retry();
      expect(store.loading()).toBe(true);
      expect(store.error()).toBeNull();
    });

    it('keeps showing the data when a later poll fails', () => {
      mode$.next('5s');
      let n = 0;
      answers = () => (n++ === 0 ? of(historyOf(samplesBetween(0, 2))) : throwError(failure));
      start();
      vi.advanceTimersByTime(5_000);
      expect(store.error()).toBeNull();
      expect(times(store.samples())).toEqual([0, 1, 2]);
      // ...and it tries again at the next interval.
      vi.advanceTimersByTime(5_000);
      expect(processHistory).toHaveBeenCalledTimes(3);
    });

    it('treats an empty answer as loaded: no error, no samples yet', () => {
      mode$.next('off');
      start();
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.samples()).toEqual([]);
    });

    it('reports an error when live mode falls back to HTTP and that fails too', () => {
      start();
      answers = () => throwError(failure);
      live.setStatus('offline');
      expect(store.error()).not.toBeNull();
      expect(store.loading()).toBe(false);
    });
  });

  describe('uptime', () => {
    it('is unknown without samples', () => {
      start();
      expect(store.uptimeSeconds()).toBeNull();
    });

    it('ticks every second from the latest sample', () => {
      start();
      lastCall().stream.next({
        kind: 'history',
        history: historyOf([sampleAt(0, { uptimeSeconds: 100 })]),
      });
      expect(store.uptimeSeconds()).toBe(100);
      vi.advanceTimersByTime(3_000);
      TestBed.tick();
      expect(store.uptimeSeconds()).toBe(103);
      lastCall().stream.next({ kind: 'tick', sample: sampleAt(4, { uptimeSeconds: 104 }) });
      expect(store.uptimeSeconds()).toBe(104);
    });
  });

  describe('stream inspector', () => {
    const text = () => store.inspector().map((e) => `${e.symbol} ${e.event} ${e.preview}`);

    it('starts empty', () => {
      start();
      expect(store.inspector()).toEqual([]);
    });

    it('logs the subscribe message, its ack and the ticks, newest first, with client time', () => {
      start();
      const { stream } = lastCall();
      stream.next({ kind: 'sent', event: 'subscribe:metrics', payload: { since: tsAt(2) } });
      stream.next({ kind: 'history', history: historyOf(samplesBetween(3, 5)) });
      stream.next({ kind: 'tick', sample: sampleAt(6) });

      const [tick, ack, sent] = store.inspector();
      expect(sent).toMatchObject({
        direction: 'sent',
        symbol: '↑',
        event: 'subscribe:metrics',
        preview: `{"since":"${tsAt(2)}"}`,
        time: '14:00:00.000',
      });
      expect(ack).toMatchObject({
        direction: 'received',
        symbol: '↓',
        event: 'subscribe:metrics (ack)',
        preview: 'history: 3 samples, 14:00:03 → 14:00:05',
      });
      expect(tick).toMatchObject({ direction: 'received', event: 'metrics:tick' });
      expect(tick.preview.startsWith('{"ts":"2026-11-05T14:00:06.000Z"')).toBe(true);
    });

    it('logs the connection events', () => {
      start();
      live.lifecycle.next({ kind: 'connect' });
      live.lifecycle.next({ kind: 'disconnect', reason: 'ping timeout' });
      live.lifecycle.next({ kind: 'reconnect_attempt', attempt: 2 });
      live.lifecycle.next({ kind: 'connect_error', message: 'xhr poll error' });
      expect(text()).toEqual([
        '• connect_error xhr poll error',
        '• reconnect_attempt attempt 2',
        '• disconnect ping timeout',
        '• connect ',
      ]);
    });

    it('logs the HTTP polls as a summary, and their failures', () => {
      mode$.next('5s');
      let n = 0;
      answers = () =>
        n++ === 0
          ? of(historyOf(samplesBetween(0, 4)))
          : throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' }));
      start();
      vi.advanceTimersByTime(5_000);
      expect(text()).toEqual([
        'HTTP GET /api/site-metrics/process failed: HTTP 503',
        'HTTP GET /api/site-metrics/process 5 samples, 14:00:00 → 14:00:04',
      ]);
    });

    it('logs a refused subscription', () => {
      start();
      lastCall().stream.error(new LiveSubscribeError('page_disabled', 'Page disabled'));
      expect(text()[text().length - 1]).toBe('↓ subscribe:metrics (ack) refused: page_disabled');
    });

    it('keeps the last 8 entries', () => {
      start();
      for (let i = 0; i < 12; i++) {
        lastCall().stream.next({ kind: 'tick', sample: sampleAt(i) });
      }
      expect(store.inspector()).toHaveLength(8);
      expect(store.inspector()[0].preview).toContain(tsAt(11));
    });
  });
});
