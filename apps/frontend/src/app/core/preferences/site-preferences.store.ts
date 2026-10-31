import { Service, inject, signal } from '@angular/core';
import type { SitePreferences, UpdateSitePreferencesRequest } from '@my-resume/api-models';
import { Observable, catchError, finalize, map, of, share, tap } from 'rxjs';
import { PreferencesApi } from './preferences-api.service';

/**
 * The site preferences as the app knows them: the single owner of this state (the menu, the route
 * guard and the admin page all read it here). Loaded once per app load, not cached in storage, so
 * a visitor never sees stale visibility.
 * A future `content:changed` push from the live gateway (spec, build step 8) could call a reload.
 */
@Service()
export class SitePreferencesStore {
  private readonly api = inject(PreferencesApi);
  private readonly state = signal<SitePreferences | null>(null);
  private request$?: Observable<void>;

  /** `null` until loaded, and after a failed load. */
  readonly preferences = this.state.asReadonly();

  /**
   * Loads the preferences once. While a request is in flight every caller gets the same
   * observable, which emits once and completes when the request succeeds or fails (it never
   * errors); a later call tries again after a failure. The request keeps going even if every
   * caller unsubscribes (the route guard stops waiting after a timeout), so the menu still updates.
   */
  load(): Observable<void> {
    if (this.state() !== null) return of(undefined);
    this.request$ ??= this.api.get().pipe(
      tap((prefs) => {
        // A save that finished meanwhile is newer than this response.
        if (this.state() === null) this.state.set(prefs);
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => (this.request$ = undefined)),
      share({ resetOnRefCountZero: false }),
    );
    return this.request$;
  }

  /** `PATCH`es the preferences and publishes the response; errors are passed on. */
  save(body: UpdateSitePreferencesRequest): Observable<SitePreferences> {
    return this.api.update(body).pipe(tap((prefs) => this.state.set(prefs)));
  }
}
