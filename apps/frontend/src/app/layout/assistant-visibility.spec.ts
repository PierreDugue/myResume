import type { SitePreferences } from '@my-resume/api-models';
import { showsAssistant } from './assistant-visibility';

const prefs = (enabled: boolean, configured: boolean): SitePreferences => ({
  pages: {
    overview: true,
    explore: true,
    traces: true,
    serviceMap: true,
    quality: true,
    siteMetrics: true,
    about: true,
  },
  overview: { skillsOverTime: [] },
  assistant: { enabled, configured },
});
const ON = prefs(true, true);
/** What an old backend still answers during a deploy: no `assistant` group. */
const OLD_BACKEND = { pages: ON.pages, overview: ON.overview } as unknown as SitePreferences;

describe('showsAssistant', () => {
  it.each<[string, SitePreferences | null, string, boolean]>([
    ['enabled and configured, on the home page', ON, '/', true],
    ['enabled and configured, on Explore with a query', ON, '/explore?query=x', true],
    ['enabled and configured, on the plain view', ON, '/resume', true],
    ['enabled but not configured', prefs(true, false), '/', false],
    ['disabled by the admin', prefs(false, true), '/', false],
    ['disabled and not configured', prefs(false, false), '/', false],
    ['preferences not loaded yet', null, '/', false],
    ['an old backend with no assistant group', OLD_BACKEND, '/', false],
    ['the admin home', ON, '/admin', false],
    ['the login page', ON, '/admin/login', false],
    ['an admin page', ON, '/admin/skills/1', false],
    ['the admin home with a query string', ON, '/admin?x=1', false],
    ['a public path that only starts with "admin"', ON, '/administrator', true],
  ])('%s', (_name, preferences, url, expected) => {
    expect(showsAssistant(preferences, url)).toBe(expected);
  });
});
