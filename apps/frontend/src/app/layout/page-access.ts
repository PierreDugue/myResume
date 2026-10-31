import { Service, computed, inject } from '@angular/core';
import type { PublicPageId } from '@my-resume/api-models';
import { AuthService } from '../core/auth/auth.service';
import { SitePreferencesStore } from '../core/preferences/site-preferences.store';
import { NAV_ITEMS } from './nav-items';

/** The plain view: always available, and where visitors land when every page is disabled. */
const PLAIN_VIEW_PATH = '/resume';

/**
 * Who may view which public page (docs/spec.md, Admin area, Preferences). The admin sees every
 * page; visitors see the enabled ones. While the preferences are unknown (not loaded yet, or the
 * request failed) every page is allowed: the API refuses disabled pages anyway.
 * It lives in `layout/` because it needs the navigation registry.
 */
@Service()
export class PageAccess {
  private readonly store = inject(SitePreferencesStore);
  private readonly auth = inject(AuthService);

  /** Where to send a viewer who can't see the page they asked for (or who opens the home page). */
  readonly landingPath = computed(
    () => NAV_ITEMS.find((item) => this.canView(item.page))?.path ?? PLAIN_VIEW_PATH,
  );

  canView(page: PublicPageId): boolean {
    return this.auth.isAuthenticated() || !this.isHidden(page);
  }

  /** Disabled by the admin: visitors don't see it (the admin sees it marked as hidden). */
  isHidden(page: PublicPageId): boolean {
    return this.store.preferences()?.pages[page] === false;
  }
}
