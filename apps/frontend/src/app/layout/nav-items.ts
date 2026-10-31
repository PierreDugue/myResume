import type { PublicPageId } from '@my-resume/api-models';

export interface NavItem {
  label: string;
  /** The page's id in the site preferences: the admin can hide the page from visitors. */
  page: PublicPageId;
  path: string;
  /** Only active on an exact URL match (needed for "/"). */
  exact: boolean;
}

/**
 * Main navigation, and the registry of the public pages the admin can hide. Each feature adds its
 * page here when it is built (see docs/spec.md). The order matters: the first page a viewer can
 * see is where they land when the home page is hidden (see PageAccess).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Career Overview', page: 'overview', path: '/', exact: true },
  { label: 'Explore', page: 'explore', path: '/explore', exact: false },
  { label: 'Traces', page: 'traces', path: '/traces', exact: false },
  { label: 'Service map', page: 'serviceMap', path: '/service-map', exact: false },
  { label: 'Code quality', page: 'quality', path: '/dashboards/quality', exact: false },
  { label: 'About this site', page: 'about', path: '/about-this-site', exact: false },
];
