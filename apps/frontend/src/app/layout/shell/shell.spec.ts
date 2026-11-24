import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AssistantApi } from '../../core/assistant/assistant-api.service';
import { type } from '../../admin/testing/render';
import { ApiStatus, ApiStatusService } from '../../core/api/api-status.service';
import { APP_NAME } from '../../core/app-name';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { providePageTitleStrategy } from '../../core/title/page-title.strategy';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import type { PublicPageId, SitePreferences } from '@my-resume/api-models';
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
  const preferences = signal<SitePreferences | null>(null);
  const ask = vi.fn(() => of({ answer: 'Ten years in IT.', explore: null }));
  const withDisabled = (...off: PublicPageId[]): SitePreferences => ({
    pages: Object.fromEntries(NAV_ITEMS.map((i) => [i.page, !off.includes(i.page)])) as never,
    overview: { skillsOverTime: [] },
    assistant: { enabled: false, configured: false },
  });

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
              { path: 'admin/login', title: 'Sign in', component: Page },
            ],
          },
        ]),
        providePageTitleStrategy(),
        { provide: ApiStatusService, useValue: { status: apiStatus.asReadonly(), startPolling } },
        {
          provide: AuthService,
          useValue: { isAuthenticated: isAuthenticated.asReadonly(), logout },
        },
        { provide: AssistantApi, useValue: { ask } },
        { provide: SitePreferencesStore, useValue: { preferences: preferences.asReadonly() } },
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
    preferences.set(null);
    logout.mockReset();
    ask.mockClear();
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

  // Temporarily disabled: checking whether the polling (GET /api/health pings the database) is
  // what keeps Neon awake.
  it('does not poll the API status', async () => {
    await render();
    expect(startPolling).not.toHaveBeenCalled();
  });

  it('shows the API status with text, not only color', async () => {
    const { root, harness } = await render();

    const status = root.querySelector('.api-status');
    expect(status?.getAttribute('data-status')).toBe('up');
    expect(status?.textContent).toMatch(/API\s+up/);

    apiStatus.set('down');
    harness.detectChanges();
    expect(status?.getAttribute('data-status')).toBe('down');
    expect(status?.textContent).toMatch(/API\s+down/);
  });

  describe('cold start banner', () => {
    const banner = (root: HTMLElement) => root.querySelector('.cold-start');

    it('tells visitors the backend is waking up while the API is starting', async () => {
      apiStatus.set('starting');
      const { root } = await render();

      const alert = banner(root);
      expect(alert?.getAttribute('role')).toBe('status');
      expect(alert?.textContent).toContain('The backend is waking up');
      expect(alert?.textContent).toContain('will load by itself');
      // The backend no longer sleeps: the cause is a deploy or a restart, not free hosting.
      expect(alert?.textContent).toContain('deployed or restarted');
      expect(alert?.textContent).not.toContain('free hosting');
      expect(root.querySelector('.api-status')?.textContent).toMatch(/API\s+starting/);
    });

    it('sits above the page content, inside the main landmark', async () => {
      apiStatus.set('starting');
      const { root } = await render();
      const main = $(root, 'main');
      expect(main.firstElementChild?.classList).toContain('cold-start');
      expect(main.textContent).toContain('page content');
    });

    it('goes away by itself once the API is up', async () => {
      apiStatus.set('starting');
      const { root, harness } = await render();
      expect(banner(root)).not.toBeNull();

      apiStatus.set('up');
      harness.detectChanges();
      expect(banner(root)).toBeNull();
    });

    it.each<ApiStatus>(['unknown', 'up', 'down'])('is not shown when the API is %s', async (s) => {
      apiStatus.set(s);
      const { root } = await render();
      expect(banner(root)).toBeNull();
    });
  });

  describe('pages disabled by the admin', () => {
    const menu = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main"] a')].map((a) =>
        a.textContent?.replace(/\s+/g, ' ').trim(),
      );

    it('hides them from the menu of visitors', async () => {
      preferences.set(withDisabled('explore', 'quality'));
      const { root } = await render();
      expect(menu(root)).toEqual([
        'Career Overview',
        'Traces',
        'Service map',
        'Site metrics',
        'About this site',
      ]);
    });

    it('shows them to the admin, marked "Hidden" with text', async () => {
      isAuthenticated.set(true);
      preferences.set(withDisabled('explore'));
      const { root } = await render();
      expect(menu(root)).toEqual([
        'Career Overview',
        'Explore Hidden',
        'Traces',
        'Service map',
        'Code quality',
        'Site metrics',
        'About this site',
      ]);
      const badge = $(root, 'nav[aria-label="Main"] .tag');
      expect(badge.textContent?.trim()).toBe('Hidden');
      expect(badge.getAttribute('title')).toBe('Hidden from visitors');
    });

    it('updates the menu when the preferences or the session change', async () => {
      preferences.set(withDisabled('explore'));
      const { root, harness } = await render();
      expect(menu(root)).not.toContain('Explore');

      isAuthenticated.set(true);
      harness.detectChanges();
      expect(menu(root)).toContain('Explore Hidden');

      preferences.set(withDisabled());
      harness.detectChanges();
      expect(menu(root)).toContain('Explore');
    });

    it('points the app name and "Home" to the first page the viewer can see', async () => {
      preferences.set(withDisabled('overview', 'explore'));
      const { root } = await render('/resume');
      expect($(root, 'a.brand').getAttribute('href')).toBe('/traces');
      expect($(root, 'nav[aria-label="Breadcrumb"] a').getAttribute('href')).toBe('/traces');
    });

    it('points them to the plain view when every page is disabled', async () => {
      preferences.set(withDisabled(...NAV_ITEMS.map((i) => i.page)));
      const { root } = await render('/resume');
      expect($(root, 'a.brand').getAttribute('href')).toBe('/resume');
      expect($(root, 'nav[aria-label="Breadcrumb"] a').getAttribute('href')).toBe('/resume');
      expect(menu(root)).toEqual([]);
    });
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

  describe('"Ask my resume" assistant', () => {
    const withAssistant = (enabled: boolean, configured: boolean): SitePreferences => ({
      ...withDisabled(),
      assistant: { enabled, configured },
    });
    const toggle = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLButtonElement>('header button')].find(
        (b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim() === 'Ask my resume',
      );
    const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('#assistant-panel');
    /** Lets the lazy panel load, then renders. */
    const settle = async (harness: {
      fixture: { whenStable(): Promise<unknown> };
      detectChanges(): void;
    }) => {
      harness.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    const closeButton = (root: HTMLElement) =>
      [...$(root, '#assistant-panel').querySelectorAll('button')].find((b) =>
        /close/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''),
      );
    const isShown = (root: HTMLElement) => {
      const el = panel(root);
      return el !== null && !el.hidden;
    };

    it('has a collapsed "Ask my resume" button in the top bar, and no panel yet', async () => {
      preferences.set(withAssistant(true, true));
      const { root } = await render('/');
      const button = toggle(root);
      expect(button).toBeDefined();
      expect(button?.getAttribute('aria-expanded')).toBe('false');
      expect(button?.getAttribute('aria-controls')).toBe('assistant-panel');
      expect(panel(root)).toBeNull();
      expect(root.querySelector('app-assistant-panel')).toBeNull();
    });

    it('opens the panel, a landmark named "Ask my resume", when the button is clicked', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);

      expect(toggle(root)?.getAttribute('aria-expanded')).toBe('true');
      const region = $(root, '#assistant-panel');
      expect(region.hidden).toBe(false);
      expect(region.getAttribute('aria-label')).toBe('Ask my resume');
      expect(['complementary', 'region']).toContain(
        region.getAttribute('role') ?? (region.tagName === 'ASIDE' ? 'complementary' : ''),
      );
    });

    it('is also available on the plain view', async () => {
      preferences.set(withAssistant(true, true));
      const { root } = await render('/resume');
      expect(toggle(root)).toBeDefined();
    });

    it('closes with its close button, and focus goes back to the toggle', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      $<HTMLTextAreaElement>(root, '#assistant-panel textarea').focus();

      closeButton(root)?.click();
      await settle(harness);

      expect(isShown(root)).toBe(false);
      expect(toggle(root)?.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle(root));
    });

    it('closes with Escape, and focus goes back to the toggle', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      const input = $<HTMLTextAreaElement>(root, '#assistant-panel textarea');
      input.focus();

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle(harness);

      expect(isShown(root)).toBe(false);
      expect(document.activeElement).toBe(toggle(root));
    });

    it('still closes with Escape after a question was answered, without re-focusing the box', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      const input = $<HTMLTextAreaElement>(root, '#assistant-panel textarea');
      input.focus();
      type(input, 'How long in IT?');
      await settle(harness);
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await settle(harness);
      expect($(root, '#assistant-panel').textContent).toContain('Ten years in IT.');

      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle(harness);

      expect(isShown(root)).toBe(false);
      expect(document.activeElement).toBe(toggle(root));
    });

    it('closes when the toggle is clicked again', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      toggle(root)?.click();
      await settle(harness);
      expect(isShown(root)).toBe(false);
      expect(toggle(root)?.getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps the conversation when the panel is closed and opened again', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      type($(root, '#assistant-panel textarea'), 'How long in IT?');
      await settle(harness);
      $<HTMLButtonElement>(root, '#assistant-panel button[type="submit"]').click();
      await settle(harness);
      expect($(root, '#assistant-panel').textContent).toContain('Ten years in IT.');

      closeButton(root)?.click();
      await settle(harness);
      toggle(root)?.click();
      await settle(harness);

      expect(isShown(root)).toBe(true);
      expect($(root, '#assistant-panel').textContent).toContain('How long in IT?');
      expect($(root, '#assistant-panel').textContent).toContain('Ten years in IT.');
      expect(ask).toHaveBeenCalledOnce();
    });

    it.each<[string, SitePreferences | null]>([
      ['the admin turned it off', withAssistant(false, true)],
      ['the server has no key', withAssistant(true, false)],
      ['the preferences are not loaded', null],
    ])('has no button and no panel when %s', async (_name, prefs) => {
      preferences.set(prefs);
      const { root } = await render('/');
      expect(toggle(root)).toBeUndefined();
      expect(panel(root)).toBeNull();
    });

    it.each(['/admin', '/admin/login'])('has no button on %s', async (url) => {
      preferences.set(withAssistant(true, true));
      const { root } = await render(url);
      expect(toggle(root)).toBeUndefined();
      expect(panel(root)).toBeNull();
    });

    it('drops the button when the admin turns the assistant off', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      expect(toggle(root)).toBeDefined();

      preferences.set(withAssistant(false, true));
      harness.detectChanges();
      expect(toggle(root)).toBeUndefined();
    });

    it('stays closed when the assistant comes back after navigating to an admin page', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);
      expect(isShown(root)).toBe(true);

      await harness.navigateByUrl('/admin');
      await settle(harness);
      await harness.navigateByUrl('/');
      await settle(harness);

      expect(toggle(root)?.getAttribute('aria-expanded')).toBe('false');
      expect(isShown(root)).toBe(false);
    });

    it('stays closed when the admin turns it off and on again', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      toggle(root)?.click();
      await settle(harness);

      preferences.set(withAssistant(false, true));
      await settle(harness);
      preferences.set(withAssistant(true, true));
      await settle(harness);

      expect(toggle(root)?.getAttribute('aria-expanded')).toBe('false');
      expect(isShown(root)).toBe(false);
    });

    it('drops the button when navigating to an admin page', async () => {
      preferences.set(withAssistant(true, true));
      const { root, harness } = await render('/');
      await harness.navigateByUrl('/admin');
      harness.detectChanges();
      expect(toggle(root)).toBeUndefined();
    });
  });
});
