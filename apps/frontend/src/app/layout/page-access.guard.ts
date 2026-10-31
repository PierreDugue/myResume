import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import type { PublicPageId } from '@my-resume/api-models';
import { SitePreferencesStore } from '../core/preferences/site-preferences.store';
import { Observable, map, of, timeout } from 'rxjs';
import { PageAccess } from './page-access';

/**
 * How long a navigation waits for the site preferences. Same threshold as the API status
 * "starting" (a sleeping backend): after that the page opens anyway (fail open), the request
 * keeps going, and the menu updates when it arrives.
 */
export const PAGE_PREFERENCES_WAIT_MS = 3_000;

/** Route `data` of a public page, typed so a typo in a page id fails to compile. */
export function page(id: PublicPageId): { page: PublicPageId } {
  return { page: id };
}

/**
 * Requests whose bounded wait already timed out. The store hands every caller the same observable
 * while a request is in flight, so a later navigation recognises it and fails open at once; a new
 * request (after the old one ended) is a new observable and gets its own wait.
 */
const timedOut = new WeakSet<Observable<void>>();

function waitAtMost(ms: number, work$: Observable<void>): Observable<void> {
  if (timedOut.has(work$)) return of(undefined);
  return work$.pipe(
    timeout({
      first: ms,
      with: () => {
        timedOut.add(work$);
        return of(undefined);
      },
    }),
  );
}

/**
 * Keeps visitors off the pages the admin disabled: they go to the landing page instead (the first
 * enabled page, or the plain view). Waiting for the preferences first also means the menu never
 * shows a page that then disappears.
 */
export const pageAccessGuard: CanActivateChildFn = (route) => {
  const store = inject(SitePreferencesStore);
  const access = inject(PageAccess);
  const router = inject(Router);

  const id = route.data['page'] as PublicPageId | undefined;
  return waitAtMost(PAGE_PREFERENCES_WAIT_MS, store.load()).pipe(
    map(() => !id || access.canView(id) || router.parseUrl(access.landingPath())),
  );
};
