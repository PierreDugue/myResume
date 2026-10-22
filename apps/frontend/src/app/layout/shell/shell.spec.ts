import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApiStatus, ApiStatusService } from '../../core/api/api-status.service';
import { APP_NAME } from '../../core/app-name';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { providePageTitleStrategy } from '../../core/title/page-title.strategy';
import { NAV_ITEMS } from '../nav-items';
import { Shell } from './shell';
import { $ } from '../../testing';

@Component({ template: '<p>page content</p>' })
class Page {}

describe('Shell', () => {
  const apiStatus = signal<ApiStatus>('up');
  const startPolling = vi.fn();
  const isAuthenticated = signal(false);
  const logout = vi.fn();

  async function render(url = '/') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Shell,
            children: [
              { path: '', title: 'Career Overview', component: Page },
              { path: 'resume', title: 'Plain view', component: Page },
              { path: 'admin', title: 'Admin', component: Page },
            ],
          },
        ]),
        providePageTitleStrategy(),
        { provide: ApiStatusService, useValue: { status: apiStatus.asReadonly(), startPolling } },
        {
          provide: AuthService,
          useValue: { isAuthenticated: isAuthenticated.asReadonly(), logout },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return { harness, root: harness.fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    localStorage.clear();
    apiStatus.set('up');
    startPolling.mockReset();
    isAuthenticated.set(false);
    logout.mockReset();
  });

  it('shows the app name as a link to the home dashboard', async () => {
    const { root } = await render();
    const brand = root.querySelector<HTMLAnchorElement>('a.brand');
    expect(brand?.textContent).toContain(APP_NAME);
    expect(brand?.getAttribute('href')).toBe('/');
  });

  it('renders one main-navigation link per nav item', async () => {
    const { root } = await render();
    const links = root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main"] a');
    expect(links).toHaveLength(NAV_ITEMS.length);
    NAV_ITEMS.forEach((item, i) => {
      expect(links[i].textContent).toContain(item.label);
      expect(links[i].getAttribute('href')).toBe(item.path);
    });
  });

  it('marks the link of the current page with aria-current="page"', async () => {
    const { root } = await render('/');
    const current = root.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    expect(current?.textContent).toContain('Career Overview');
  });

  it('shows the current page title as the page heading in the breadcrumb', async () => {
    const { root, harness } = await render('/resume');
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain(
      'Plain view',
    );

    await harness.navigateByUrl('/');
    harness.detectChanges();
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain(
      'Career Overview',
    );
  });

  it('renders the routed page inside the main landmark, reachable with a skip link', async () => {
    const { root } = await render();
    const main = root.querySelector('main#main-content');
    expect(main?.textContent).toContain('page content');
    expect(root.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
  });

  it('links to the plain view from the top bar', async () => {
    const { root } = await render();
    const link = root.querySelector<HTMLAnchorElement>('header a.plain-view');
    expect(link?.getAttribute('href')).toBe('/resume');
  });

  it('toggles the theme with an accessible button', async () => {
    const { root, harness } = await render();
    const theme = TestBed.inject(ThemeService);
    const button = root.querySelector<HTMLButtonElement>('button.theme-toggle');
    expect(theme.theme()).toBe('dark');
    expect(button?.getAttribute('aria-label')).toBe('Switch to light theme');

    button?.click();
    harness.detectChanges();

    expect(theme.theme()).toBe('light');
    expect(button?.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('opens and closes the sidebar with the menu button (small screens)', async () => {
    const { root, harness } = await render();
    const menu = root.querySelector<HTMLButtonElement>('button.menu-toggle');
    const sidebar = root.querySelector('aside.sidebar');
    expect(menu?.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar?.classList).not.toContain('open');

    menu?.click();
    harness.detectChanges();
    expect(menu?.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar?.classList).toContain('open');

    menu?.click();
    harness.detectChanges();
    expect(menu?.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the sidebar after navigating', async () => {
    const { root, harness } = await render();
    root.querySelector<HTMLButtonElement>('button.menu-toggle')?.click();
    harness.detectChanges();

    await harness.navigateByUrl('/resume');
    harness.detectChanges();

    expect(root.querySelector('aside.sidebar')?.classList).not.toContain('open');
  });

  it('starts polling the API status and shows it with text, not only color', async () => {
    const { root, harness } = await render();
    expect(startPolling).toHaveBeenCalledWith(30_000);

    const status = root.querySelector('.api-status');
    expect(status?.getAttribute('data-status')).toBe('up');
    expect(status?.textContent).toMatch(/API\s+up/);

    apiStatus.set('down');
    harness.detectChanges();
    expect(status?.getAttribute('data-status')).toBe('down');
    expect(status?.textContent).toMatch(/API\s+down/);
  });

  describe('account links (sidebar)', () => {
    it('offers "Sign in" to visitors', async () => {
      const { root } = await render();
      const link = root.querySelector<HTMLAnchorElement>('aside a.sign-in');
      expect(link?.getAttribute('href')).toBe('/admin/login');
      expect(root.querySelector('aside button.sign-out')).toBeNull();
    });

    it('offers "Admin" and "Sign out" to the signed-in admin', async () => {
      isAuthenticated.set(true);
      const { root } = await render();
      expect(root.querySelector('aside a.sign-in')).toBeNull();
      expect(
        root.querySelector<HTMLAnchorElement>('aside a.admin-link')?.getAttribute('href'),
      ).toBe('/admin');
    });

    it('signs out and goes back to the home dashboard', async () => {
      isAuthenticated.set(true);
      const { root, harness } = await render('/admin');
      $<HTMLButtonElement>(root, 'aside button.sign-out').click();
      await harness.fixture.whenStable();
      expect(logout).toHaveBeenCalledOnce();
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });
});
