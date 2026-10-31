import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from './app.routes';
import { APP_NAME } from './core/app-name';
import { providePageTitleStrategy } from './core/title/page-title.strategy';
import { AUTH_STORAGE_KEY, AuthService } from './core/auth/auth.service';
import { fakeJwt, inSeconds } from './core/auth/test-tokens';
import type { PublicPageId as PageId, SitePreferences } from '@my-resume/api-models';

function preferences(off: PageId[] = []): SitePreferences {
  return {
    pages: {
      overview: !off.includes('overview'),
      explore: !off.includes('explore'),
      traces: !off.includes('traces'),
      serviceMap: !off.includes('serviceMap'),
      quality: !off.includes('quality'),
      about: !off.includes('about'),
    },
  };
}
const EVERY_PAGE: PageId[] = ['overview', 'explore', 'traces', 'serviceMap', 'quality', 'about'];

describe('appRoutes', () => {
  let asked: boolean;

  beforeEach(() => {
    asked = false;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePageTitleStrategy(),
      ],
    });
  });

  /**
   * The first navigation waits for `GET /api/preferences` (the route guard): answer it with every
   * page enabled except `off`. Later navigations don't ask again.
   */
  async function navigate(harness: RouterTestingHarness, url: string, off: PageId[] = []) {
    const http = TestBed.inject(HttpTestingController);
    const navigation = harness.navigateByUrl(url);
    if (!asked) {
      asked = true;
      const [request] = await vi.waitFor(() => {
        const open = http.match('/api/preferences');
        if (open.length === 0) throw new Error('preferences not requested yet');
        return open;
      });
      request.flush(preferences(off));
    }
    await navigation;
    harness.detectChanges();
  }

  async function visit(url: string, off: PageId[] = []) {
    const harness = await RouterTestingHarness.create();
    await navigate(harness, url, off);
    return harness.fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['/', 'Career Overview', 'app-overview-page'],
    ['/admin/login', 'Sign in', 'app-login-page'],
    ['/resume', 'Plain view', 'app-plain-resume-page'],
    ['/explore', 'Explore', 'app-explore-page'],
    ['/traces', 'Traces', 'app-trace-search-page'],
    ['/traces/pierre-o11y', 'Trace', 'app-trace-page'],
    ['/service-map', 'Service map', 'app-service-map-page'],
    ['/dashboards/quality', 'This codebase, observed', 'app-quality-page'],
    ['/about-this-site', 'About this site', 'app-about-page'],
    ['/this/does/not/exist', 'Page not found', 'app-not-found-page'],
  ])('%s renders "%s" inside the app shell', async (url, title, pageSelector) => {
    const root = await visit(url);
    expect(root.querySelector('app-shell')).not.toBeNull();
    expect(root.querySelector(`app-shell main ${pageSelector}`)).not.toBeNull();
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain(title);
    expect(TestBed.inject(Title).getTitle()).toBe(`${title} · ${APP_NAME}`);
  });

  it('lists Explore in the main navigation', async () => {
    const root = await visit('/explore');
    const current = root.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    expect(current?.textContent).toContain('Explore');
    expect(current?.getAttribute('href')).toBe('/explore');
  });

  it.each([
    ['/traces', 'Traces'],
    ['/traces/pierre-o11y', 'Traces'],
    ['/service-map', 'Service map'],
    ['/dashboards/quality', 'Code quality'],
    ['/about-this-site', 'About this site'],
  ])('marks %s as "%s" in the main navigation', async (url, label) => {
    const root = await visit(url);
    const current = root.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    expect(current?.textContent).toContain(label);
  });

  it('offers a link back to the home dashboard on the not-found page', async () => {
    const root = await visit('/nope');
    expect(root.querySelector('app-not-found-page a')?.getAttribute('href')).toBe('/');
  });

  it('redirects /admin to the login page when signed out', async () => {
    await visit('/admin');
    expect(TestBed.inject(Router).url).toBe('/admin/login?returnUrl=%2Fadmin');
  });

  it('shows the admin home when signed in', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(3600) }));
    const root = await visit('/admin');
    expect(root.querySelector('app-shell main app-admin-home-page')).not.toBeNull();
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain('Admin');
  });

  it('shows the preferences page to the signed-in admin', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(3600) }));
    const harness = await RouterTestingHarness.create();
    await navigate(harness, '/admin/preferences');
    const root = harness.fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-shell main app-preferences-page')).not.toBeNull();
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain(
      'Preferences',
    );
  });

  it('checks the session again when moving between admin pages', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(3600) }));
    const harness = await RouterTestingHarness.create();
    await navigate(harness, '/admin');
    TestBed.inject(AuthService).logout();

    await navigate(harness, '/admin/skills');
    expect(TestBed.inject(Router).url).toBe('/admin/login?returnUrl=%2Fadmin%2Fskills');
  });

  describe('with pages disabled by the admin', () => {
    const urlAfter = () => TestBed.inject(Router).url;

    it('sends a visitor from a disabled page to the home page', async () => {
      await visit('/explore', ['explore']);
      expect(urlAfter()).toBe('/');
    });

    it('sends a visitor from a disabled trace page to the home page', async () => {
      await visit('/traces/pierre-o11y', ['traces']);
      expect(urlAfter()).toBe('/');
    });

    it('sends a visitor from the disabled home page to the first enabled page', async () => {
      await visit('/', ['overview', 'explore']);
      expect(urlAfter()).toBe('/traces');
    });

    it('hides the disabled pages from the menu', async () => {
      const root = await visit('/', ['explore']);
      const labels = [...root.querySelectorAll('nav[aria-label="Main"] a')].map((a) =>
        a.textContent?.trim(),
      );
      expect(labels).not.toContain('Explore');
      expect(labels).toContain('Traces');
    });

    it.each([['/resume'], ['/admin/login'], ['/this/does/not/exist']])(
      'keeps %s reachable when every page is disabled',
      async (url) => {
        await visit(url, EVERY_PAGE);
        expect(urlAfter()).toBe(url);
      },
    );

    it('sends a visitor to the plain view when every page is disabled', async () => {
      const root = await visit('/explore', EVERY_PAGE);
      expect(urlAfter()).toBe('/resume');
      expect(root.querySelector('app-plain-resume-page')).not.toBeNull();
      expect(root.querySelectorAll('nav[aria-label="Main"] a')).toHaveLength(0);
    });

    it('lets the signed-in admin open a disabled page, marked as hidden in the menu', async () => {
      localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(3600) }));
      const root = await visit('/explore', ['explore']);
      expect(urlAfter()).toBe('/explore');
      const current = root.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
      expect(current?.textContent).toContain('Explore');
      expect(current?.textContent).toContain('Hidden');
    });
  });
});
