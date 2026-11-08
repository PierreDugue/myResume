import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { ProcessSample } from '@my-resume/api-models';
import {
  BehaviorSubject,
  EMPTY,
  NEVER,
  Observable,
  Subject,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  exhaustMap,
  interval,
  map,
  merge,
  retry,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import {
  LiveService,
  LiveSubscribeError,
  type LiveLifecycleEvent,
  type MetricsStreamEvent,
} from '../../core/live/live.service';
import { SiteMetricsApi } from '../../core/site-metrics/site-metrics-api.service';
import { PageVisibility } from '../../core/visibility/page-visibility.service';
import type { FeedStatus } from '../../shared/refresh/feed-status';
import { pollIntervalMs, type RefreshMode } from '../../shared/refresh/refresh-mode';
import { lastTs, mergeSamples, newest } from './sample-window';
import { liveUptimeSeconds } from './site-metrics-view';
import {
  appendEntry,
  previewJson,
  streamEntry,
  summariseHistory,
  summariseSamples,
  type StreamDirection,
  type StreamLogEntry,
} from './stream-log';

/** While the live socket is down (or refused), the window is refreshed over HTTP at this rate. */
const FALLBACK_POLL_MS = 5_000;
/** Waits before trying the live stream again after a failure: 5, 10, 20 s, then every 30 s. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 30_000;
const HTTP_EVENT = 'GET /api/site-metrics/process';
const ACK_EVENT = 'subscribe:metrics (ack)';

/** What feeds the window right now: the mode, or `paused` while the tab is hidden. */
type SourceKey = RefreshMode | 'paused';

/**
 * The data of the Site metrics page: the merged window of process samples, and where it comes
 * from. Provided by the page, so it lives and dies with it: leaving the page unsubscribes, and
 * the socket closes shortly after.
 *
 * It picks the source from the refresh mode and the tab's visibility:
 * - `live`: the socket (`LiveService`); while it is offline, or the subscription failed, it also
 *   polls over HTTP every 5 s. A failed subscription (no answer, a failed import, `rate_limited`)
 *   is tried again with a backoff (5, 10, 20, then 30 s); polling stops and the badge says live
 *   again on the next history. `page_disabled` is not retried until the mode or visibility changes.
 * - `5s`, `30s`, `1m`: HTTP polling at that interval, the first call at once
 * - `off`: one load, then nothing
 * - tab hidden: nothing; when it is shown again the gap is filled from the history (`since`)
 */
@Service({ autoProvided: false })
export class ProcessMetricsStore {
  private readonly live = inject(LiveService);
  private readonly api = inject(SiteMetricsApi);
  private readonly visibility = inject(PageVisibility);
  private readonly destroyRef = inject(DestroyRef);

  private readonly window = signal<ProcessSample[]>([]);
  private readonly started = signal<string | null>(null);
  private readonly isLoading = signal(true);
  private readonly failure = signal<unknown>(null);
  private readonly log = signal<StreamLogEntry[]>([]);
  private readonly mode = signal<RefreshMode>('live');
  private readonly visible = signal(true);
  private readonly refused = signal(false);
  /** Client time (ms) when the newest sample arrived, and the clock that ticks the uptime. */
  private readonly receivedAt = signal(Date.now());
  private readonly clock = signal(Date.now());

  private readonly retries = new Subject<void>();
  private followed = false;
  /** Emits when the socket goes offline or comes back (a signal, followed by an effect). */
  private readonly socketOffline$ = toObservable(computed(() => this.live.status() === 'offline'));

  /** The merged window, oldest first, at most 300 samples. */
  readonly samples = this.window.asReadonly();
  /** When the backend process started (changes after a deploy or restart). */
  readonly startedAt = this.started.asReadonly();
  /** True until the first answer (or error). */
  readonly loading = this.isLoading.asReadonly();
  /** Set when the first load fails; later failures keep the data on screen. */
  readonly error = this.failure.asReadonly();
  /** The last 8 entries of the stream, newest first. */
  readonly inspector = this.log.asReadonly();

  readonly feedStatus = computed<FeedStatus>(() => {
    const mode = this.mode();
    if (mode === 'off') return 'off';
    if (!this.visible()) return 'paused';
    if (mode !== 'live') return `poll-${mode}`;
    if (this.refused()) return 'fallback';
    switch (this.live.status()) {
      case 'connected':
        return 'live';
      case 'reconnecting':
        return 'reconnecting';
      case 'offline':
        return 'offline';
      default:
        return 'connecting';
    }
  });

  /** The backend's uptime, ticking each second from the newest sample's. Null without samples. */
  readonly uptimeSeconds = computed(() => {
    const latest = newest(this.window());
    return latest ? liveUptimeSeconds(latest.uptimeSeconds, this.receivedAt(), this.clock()) : null;
  });

  /** Starts feeding the window from the refresh mode (the page reads it from the URL). Call once. */
  follow(mode$: Observable<RefreshMode>): void {
    if (this.followed) return;
    this.followed = true;

    this.live.lifecycle$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.logLifecycle(event));
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clock.set(Date.now()));

    combineLatest([mode$, this.visibility.visible$])
      .pipe(
        tap(([mode, visible]) => {
          this.mode.set(mode);
          this.visible.set(visible);
        }),
        // `off` ignores the tab: it never refreshes, so there is nothing to pause.
        map(([mode, visible]): SourceKey => (mode === 'off' ? 'off' : visible ? mode : 'paused')),
        distinctUntilChanged(),
        switchMap((source) =>
          this.retries.pipe(
            startWith(undefined),
            switchMap(() => this.run(source)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Tries again after a failed first load. */
  retry(): void {
    this.failure.set(null);
    this.isLoading.set(true);
    this.retries.next();
  }

  private run(source: SourceKey): Observable<unknown> {
    switch (source) {
      case 'paused':
        return EMPTY;
      case 'off':
        return this.load();
      case 'live':
        return this.liveFeed();
      default:
        return this.poll(pollIntervalMs(source) ?? FALLBACK_POLL_MS);
    }
  }

  private liveFeed(): Observable<unknown> {
    this.refused.set(false);
    const failed = new BehaviorSubject(false);
    let failures = 0;
    const stream$ = defer(() => this.live.metrics(() => lastTs(this.window()))).pipe(
      tap((event) => {
        if (event.kind !== 'history') return;
        // The socket works: back to live, and the next failure backs off from the start.
        failures = 0;
        this.refused.set(false);
        failed.next(false);
      }),
      tap((event) => this.onStream(event)),
      retry({
        delay: (error: unknown) => {
          // Refused (a disabled page, a rate limit) or no answer: HTTP does the job meanwhile.
          this.logRefusal(error);
          this.refused.set(true);
          failed.next(true);
          // A disabled page stays disabled: nothing to retry until the mode or visibility changes.
          if (error instanceof LiveSubscribeError && error.code === 'page_disabled') return NEVER;
          return timer(retryDelayMs(failures++));
        },
      }),
    );
    const fallback$ = combineLatest([failed, this.socketOffline$]).pipe(
      map(([hasFailed, offline]) => hasFailed || offline),
      distinctUntilChanged(),
      switchMap((useHttp) => (useHttp ? this.poll(FALLBACK_POLL_MS) : EMPTY)),
    );
    return merge(stream$, fallback$);
  }

  /** The first call at once, then every `ms`; a slow call is never overlapped by the next. */
  private poll(ms: number): Observable<void> {
    return interval(ms).pipe(
      startWith(0),
      exhaustMap(() => this.load()),
    );
  }

  /** One `GET /api/site-metrics/process?since=<last ts>`; a failure is logged and never errors. */
  private load(): Observable<void> {
    return defer(() => this.api.processHistory(lastTs(this.window()))).pipe(
      tap((history) => {
        this.add(history.samples, history.startedAt);
        this.append('http', HTTP_EVENT, summariseSamples(history.samples));
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        this.append('http', HTTP_EVENT, `failed: ${describeError(error)}`);
        // Only the first load shows an error: after that the data stays on screen.
        if (this.window().length === 0) this.failure.set(error);
        this.isLoading.set(false);
        return EMPTY;
      }),
    );
  }

  private onStream(event: MetricsStreamEvent): void {
    switch (event.kind) {
      case 'sent':
        this.append('sent', event.event, previewJson(event.payload));
        return;
      case 'history':
        this.add(event.history.samples, event.history.startedAt);
        this.append('received', ACK_EVENT, summariseHistory(event.history));
        return;
      case 'tick':
        this.add([event.sample]);
        this.append('received', 'metrics:tick', previewJson(event.sample));
        return;
    }
  }

  private add(samples: ProcessSample[], startedAt?: string): void {
    const before = lastTs(this.window());
    this.window.update((window) => mergeSamples(window, samples));
    if (lastTs(this.window()) !== before) this.receivedAt.set(Date.now());
    if (startedAt) this.started.set(startedAt);
    this.isLoading.set(false);
    this.failure.set(null);
  }

  private append(direction: StreamDirection, event: string, preview: string): void {
    this.log.update((log) => appendEntry(log, streamEntry(new Date(), direction, event, preview)));
  }

  private logRefusal(error: unknown): void {
    const reason = error instanceof LiveSubscribeError ? error.code : describeError(error);
    const verb = error instanceof LiveSubscribeError ? 'refused' : 'failed';
    this.append('received', ACK_EVENT, `${verb}: ${reason}`);
  }

  private logLifecycle(event: LiveLifecycleEvent): void {
    switch (event.kind) {
      case 'connect':
        return this.append('lifecycle', 'connect', '');
      case 'disconnect':
        return this.append('lifecycle', 'disconnect', event.reason);
      case 'reconnect_attempt':
        return this.append('lifecycle', 'reconnect_attempt', `attempt ${event.attempt}`);
      case 'connect_error':
        return this.append('lifecycle', 'connect_error', event.message);
    }
  }
}

function retryDelayMs(failures: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** failures, RETRY_MAX_MS);
}

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) return `HTTP ${error.status}`;
  return error instanceof Error ? error.message : String(error);
}
