import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import type { LiveLifecycleEvent, LiveStatus, MetricsStreamEvent } from '../live.service';

/** LiveService with a stream the test controls (the real one is tested on its own). */
export class FakeLive {
  private readonly state = signal<LiveStatus>('idle');
  readonly status = this.state.asReadonly();
  readonly lifecycle = new Subject<LiveLifecycleEvent>();
  readonly lifecycle$ = this.lifecycle.asObservable();
  /** One entry per `metrics()` call, in order; `since` is what the caller asked with. */
  readonly calls: {
    since: () => string | undefined;
    stream: Subject<MetricsStreamEvent>;
    active: boolean;
  }[] = [];

  readonly metrics = vi.fn((since: () => string | undefined): Observable<MetricsStreamEvent> => {
    const call = { since, stream: new Subject<MetricsStreamEvent>(), active: false };
    this.calls.push(call);
    return new Observable<MetricsStreamEvent>((subscriber) => {
      call.active = true;
      const inner = call.stream.subscribe(subscriber);
      return () => {
        call.active = false;
        inner.unsubscribe();
      };
    });
  });

  setStatus(status: LiveStatus): void {
    this.state.set(status);
    TestBed.tick(); // the store follows the signal through an effect
  }

  get activeCalls(): number {
    return this.calls.filter((c) => c.active).length;
  }
}
