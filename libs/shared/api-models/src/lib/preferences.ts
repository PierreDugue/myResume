/** The public pages the admin can enable or disable. The plain view (/resume) is not one: it is always available. */
export type PublicPageId = 'overview' | 'explore' | 'traces' | 'serviceMap' | 'quality' | 'about';

/** true = visible to visitors. Every page id is always present in responses. */
export type PagePreferences = Record<PublicPageId, boolean>;

/** Site-wide preferences, edited on /admin/preferences. One group per kind of setting; more groups will be added later. */
export interface SitePreferences {
  pages: PagePreferences;
}

/** `PATCH /api/preferences` body: every group and every key is optional; what is sent is merged into the stored preferences. */
export interface UpdateSitePreferencesRequest {
  pages?: Partial<PagePreferences>;
}
