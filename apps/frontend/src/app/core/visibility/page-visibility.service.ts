import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { Observable, distinctUntilChanged, fromEvent, map, startWith } from 'rxjs';

/**
 * Whether the browser tab is visible (Page Visibility API). Dashboards that poll or stream stop
 * while the tab is hidden, and resume when it is shown again.
 */
@Service()
export class PageVisibility {
  private readonly document = inject(DOCUMENT);

  /** Starts with the current state, then emits only when it changes. */
  readonly visible$: Observable<boolean> = fromEvent(this.document, 'visibilitychange').pipe(
    startWith(undefined),
    map(() => this.document.visibilityState !== 'hidden'),
    distinctUntilChanged(),
  );
}
