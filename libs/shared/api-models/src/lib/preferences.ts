/** The public pages the admin can enable or disable. The plain view (/resume) is not one: it is always available. */
export type PublicPageId = 'overview' | 'explore' | 'traces' | 'serviceMap' | 'quality' | 'about';

/** true = visible to visitors. Every page id is always present in responses. */
export type PagePreferences = Record<PublicPageId, boolean>;

/** Settings of the Career Overview page (`/`). */
export interface OverviewPreferences {
  /** Skill ids the "Skills over time" chart shows, in skills-list order. [] (default) = automatic: the 8 most used skills of the view. At most 8. */
  skillsOverTime: string[];
}

/** Site-wide preferences, edited on /admin/preferences. One group per kind of setting; more groups will be added later. */
export interface SitePreferences {
  pages: PagePreferences;
  overview: OverviewPreferences;
}

/** `PATCH /api/preferences` body: every group and every key is optional; what is sent is merged into the stored preferences. */
export interface UpdateSitePreferencesRequest {
  pages?: Partial<PagePreferences>;
  overview?: Partial<OverviewPreferences>;
}
