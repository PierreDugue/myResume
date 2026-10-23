import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from './app.routes';
import { APP_NAME } from './core/app-name';
import { providePageTitleStrategy } from './core/title/page-title.strategy';
import { AUTH_STORAGE_KEY } from './core/auth/auth.service';
import { fakeJwt, inSeconds } from './core/auth/test-tokens';

describe('appRoutes', () => {
  beforeEach(() => {
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

  async function visit(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['/', 'Career Overview', 'app-overview-page'],
    ['/admin/login', 'Sign in', 'app-login-page'],
    ['/resume', 'Plain view', 'app-plain-resume-page'],
    ['/explore', 'Explore', 'app-explore-page'],
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
});
