import { HttpClient } from '@angular/common/http';
import { DestroyRef, Service, inject, signal } from '@angular/core';
import type { HealthResponse } from '@my-resume/api-models';
import {
  Observable,
  Subscription,
  catchError,
  interval,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

export type ApiStatus = 'unknown' | 'up' | 'down';

/** Health of the backend, from `GET /api/health` (see docs/api-contract.md). */
@Service()
export class ApiStatusService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<ApiStatus>('unknown');
  private polling?: Subscription;

  readonly status = this.current.asReadonly();

  /** Checks the API once. */
  refresh(): void {
    this.check().subscribe((status) => this.current.set(status));
  }

  /** Checks now, then every `intervalMs`. Calling it again while polling does nothing. */
  startPolling(intervalMs: number): void {
    if (this.polling) return;
    this.polling = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.check()),
      )
      .subscribe((status) => this.current.set(status));
    this.destroyRef.onDestroy(() => this.polling?.unsubscribe());
  }

  private check(): Observable<ApiStatus> {
    return this.http.get<HealthResponse>('/api/health').pipe(
      map((res): ApiStatus => (res.status === 'ok' ? 'up' : 'down')),
      catchError(() => of<ApiStatus>('down')),
    );
  }
}
