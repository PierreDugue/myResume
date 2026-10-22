import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../core/content/content-api.service';

/**
 * Shared state of an admin edit page: the `:id` route param ("new" to create), loading the item
 * from its list, saving, then going back to the list. Call it from a field initializer.
 */
export function editPage<T extends { id: string }>(
  list: () => Observable<T[]>,
  fill: (item: T) => void,
) {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const id = route.snapshot.paramMap.get('id') ?? 'new';
  const isNew = id === 'new';
  const state = {
    id,
    isNew,
    loaded: signal(isNew),
    notFound: signal(false),
    error: signal<string | null>(null),
    /**
     * Sends `request` (create or update), then returns to the list; shows API errors.
     * Returns a promise for a signal form's submit action, so `form().submitting()` covers the wait.
     */
    save(request: Observable<unknown>): Promise<void> {
      state.error.set(null);
      return new Promise<void>((resolve) => {
        request.pipe(takeUntilDestroyed(destroyRef)).subscribe({
          next: () => {
            resolve();
            void router.navigate(['..'], { relativeTo: route });
          },
          error: (e: unknown) => {
            state.error.set(apiErrorMessage(e));
            resolve();
          },
          complete: () => resolve(),
        });
      });
    },
  };
  if (!isNew) {
    list()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (items) => {
          const item = items.find((i) => i.id === id);
          if (item) fill(item);
          else state.notFound.set(true);
          state.loaded.set(true);
        },
        error: (e: unknown) => state.error.set(apiErrorMessage(e)),
      });
  }
  return state;
}
