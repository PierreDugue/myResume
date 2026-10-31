import { computed, type Provider } from '@angular/core';
import type { PublicPageId } from '@my-resume/api-models';
import { NAV_ITEMS } from '../nav-items';
import { PageAccess } from '../page-access';

/** A `PageAccess` for page tests: a visitor who can see every page except `disabled`. */
export function fakePageAccess(disabled: PublicPageId[] = []): Provider {
  const canView = (page: PublicPageId) => !disabled.includes(page);
  const useValue: Pick<PageAccess, 'canView' | 'isHidden' | 'landingPath'> = {
    canView,
    isHidden: (page) => !canView(page),
    landingPath: computed(() => NAV_ITEMS.find((i) => canView(i.page))?.path ?? '/resume'),
  };
  return { provide: PageAccess, useValue };
}
