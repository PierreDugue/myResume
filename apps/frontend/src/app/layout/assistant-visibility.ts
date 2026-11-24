import type { SitePreferences } from '@my-resume/api-models';

/** Whether the "Ask my resume" assistant shows on `url`: enabled and configured, never under `/admin`. */
export function showsAssistant(prefs: SitePreferences | null, url: string): boolean {
  // `assistant` is missing when an old backend answers during a deploy.
  const assistant = (prefs as Partial<SitePreferences> | null)?.assistant;
  if (!assistant?.enabled || !assistant.configured) return false;
  const path = url.split(/[?#]/, 1)[0];
  return path !== '/admin' && !path.startsWith('/admin/');
}
