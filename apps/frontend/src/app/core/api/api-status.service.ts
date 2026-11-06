import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Service, inject, signal } from '@angular/core';
import type { HealthResponse } from '@my-resume/api-models';
import { PageVisibility } from '../visibility/page-visibility.service';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defer,
  map,
  merge,
  of,
  repeat,
  share,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

/**
 * `starting`: the backend is starting: after a deploy or restart, or because the hosting platform
 * is waking a sleeping free-plan service (a cold start, see docs/spec.md).
 */
export type ApiStatus = 'unknown' | 'starting' | 'up' | 'down';

/** A health check slower than this means the backend is still starting. */
const SLOW_CHECK_MS = 3_000;
/** How often to check while starting, so the banner goes away soon after the backend is up. */
const STARTING_POLL_MS = 5_000;
/**
 * A cold start takes about a minute: after this long, report "down" instead.
 * Time while the tab is hidden doesn't count: the clock restarts after the tab is shown again.
 */
const STARTING_LIMIT_MS = 120_000;
/** What the platform or nginx answer while the backend isn't up yet. */
const PROXY_ERRORS = [502, 503, 504];

/** Health of the backend, from `GET /api/health` (see docs/api-contract.md). */
@Service()
export class ApiStatusService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly visibility = inject(PageVisibility);
  private readonly current = signal<ApiStatus>('unknown');
  private polling?: Subscription;
  /** When the current cold start began, or undefined when not starting. */
  private startingSince?: number;

  readonly status = this.current.asReadonly();

  /** Checks the API once. */
  refresh(): void {
    this.check().subscribe((status) => this.update(status));
  }

  /**
   * Checks now, then every `intervalMs` (every 5 s while the API is starting).
   * Only checks while the browser tab is visible: hiding the tab stops the timers and cancels a
   * check in flight (the status keeps its last value), and showing it checks again right away.
   * Calling it again while polling does nothing.
   */
  startPolling(intervalMs: number): void {
    if (this.polling) return;
    const poll = defer(() => this.check()).pipe(
      repeat({
        delay: () => timer(this.current() === 'starting' ? STARTING_POLL_MS : intervalMs),
      }),
    );
    this.polling = this.visibility.visible$
      .pipe(
        // Hidden time doesn't count toward STARTING_LIMIT_MS.
        tap((visible) => {
          if (!visible) this.startingSince = undefined;
        }),
        switchMap((visible) => (visible ? poll : EMPTY)),
      )
      .subscribe((status) => this.update(status));
    this.destroyRef.onDestroy(() => this.polling?.unsubscribe());
  }

  /** Emits "starting" if the answer is slow, then the result of the check. */
  private check(): Observable<ApiStatus> {
    const result = this.http.get<HealthResponse>('/api/health').pipe(
      map((res): ApiStatus => (res.status === 'ok' ? 'up' : 'down')),
      catchError((error: unknown) => of(statusOfError(error))),
      share(),
    );
    const slow = timer(SLOW_CHECK_MS).pipe(
      map((): ApiStatus => 'starting'),
      takeUntil(result),
    );
    return merge(slow, result);
  }

  private update(status: ApiStatus): void {
    if (status !== 'starting') {
      this.startingSince = undefined;
      this.current.set(status);
      return;
    }
    this.startingSince ??= Date.now();
    const tooLong = Date.now() - this.startingSince >= STARTING_LIMIT_MS;
    this.current.set(tooLong ? 'down' : 'starting');
  }
}

/** A proxy error without the backend's own health report means the backend isn't up yet. */
function statusOfError(error: unknown): ApiStatus {
  if (!(error instanceof HttpErrorResponse) || !PROXY_ERRORS.includes(error.status)) return 'down';
  return isHealthReport(error.error) ? 'down' : 'starting';
}

function isHealthReport(body: unknown): body is HealthResponse {
  return typeof body === 'object' && body !== null && 'status' in body && 'details' in body;
}
