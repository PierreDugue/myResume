export interface NavItem {
  label: string;
  path: string;
  /** Only active on an exact URL match (needed for "/"). */
  exact: boolean;
}

/** Main navigation. Each feature adds its page here when it is built (see docs/spec.md). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Career Overview', path: '/', exact: true },
  { label: 'Explore', path: '/explore', exact: false },
];
