import { DestroyRef, computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/content/content-api.service';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const TEXT: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Not saved',
};

/** The saving / saved / failed state of an editor control, and the API error of its last save. */
export class SaveStatus {
  readonly state = signal<SaveState>('idle');
  /** The API's message when the last request failed. */
  readonly error = signal<string | null>(null);
  readonly text = computed(() => TEXT[this.state()]);
  readonly busy = computed(() => this.state() === 'saving');

  /** The pending request, dropped (never reported) when the control is destroyed. */
  private readonly pending = new Subscription();

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.pending.unsubscribe());
  }

  /**
   * Sends `request` (ignored while one is pending, or once the control is destroyed), then calls
   * `done` or `failed`. Nothing is called after the control is destroyed.
   */
  run<T>(request: Observable<T>, done?: () => void, failed?: () => void): void {
    if (this.busy() || this.pending.closed) return;
    this.state.set('saving');
    this.error.set(null);
    // Once per request (its first value or its completion), even if `done` starts the next one.
    let settled = false;
    const succeed = () => {
      if (settled) return;
      settled = true;
      this.state.set('saved');
      done?.();
    };
    this.pending.add(
      request.subscribe({
        next: succeed,
        complete: succeed,
        error: (e: unknown) => {
          this.state.set('failed');
          this.error.set(apiErrorMessage(e));
          failed?.();
        },
      }),
    );
  }

  /** A value refused before sending (validation): nothing was saved. */
  refuse(): void {
    this.state.set('failed');
    this.error.set(null);
  }

  reset(): void {
    this.state.set('idle');
    this.error.set(null);
  }
}
