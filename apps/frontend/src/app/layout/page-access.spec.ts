import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PagePreferences, SitePreferences } from '@my-resume/api-models';
import { AuthService } from '../core/auth/auth.service';
import { SitePreferencesStore } from '../core/preferences/site-preferences.store';
import { PageAccess } from './page-access';

const pages = (off: (keyof PagePreferences)[] = []): SitePreferences => ({
  pages: {
    overview: !off.includes('overview'),
    explore: !off.includes('explore'),
    traces: !off.includes('traces'),
    serviceMap: !off.includes('serviceMap'),
    quality: !off.includes('quality'),
    about: !off.includes('about'),
  },
  overview: { skillsOverTime: [] },
});
const ALL: (keyof PagePreferences)[] = [
  'overview',
  'explore',
  'traces',
  'serviceMap',
  'quality',
  'about',
];

describe('PageAccess', () => {
  const preferences = signal<SitePreferences | null>(null);
  const isAuthenticated = signal(false);
  let access: PageAccess;

  beforeEach(() => {
    preferences.set(null);
    isAuthenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: SitePreferencesStore, useValue: { preferences: preferences.asReadonly() } },
        { provide: AuthService, useValue: { isAuthenticated: isAuthenticated.asReadonly() } },
      ],
    });
    access = TestBed.inject(PageAccess);
  });

  describe('for a visitor', () => {
    it('lets them view enabled pages and not disabled ones', () => {
      preferences.set(pages(['explore']));
      expect(access.canView('explore')).toBe(false);
      expect(access.canView('traces')).toBe(true);
      expect(access.isHidden('explore')).toBe(true);
      expect(access.isHidden('traces')).toBe(false);
    });

    it('fails open while the preferences are not known', () => {
      expect(access.canView('explore')).toBe(true);
      expect(access.isHidden('explore')).toBe(false);
      expect(access.landingPath()).toBe('/');
    });

    it('follows the preferences when they change', () => {
      preferences.set(pages());
      expect(access.canView('explore')).toBe(true);
      preferences.set(pages(['explore']));
      expect(access.canView('explore')).toBe(false);
    });
  });

  describe('for the signed-in admin', () => {
    beforeEach(() => isAuthenticated.set(true));

    it('can view every page, and knows which ones are hidden from visitors', () => {
      preferences.set(pages(['explore']));
      expect(access.canView('explore')).toBe(true);
      expect(access.isHidden('explore')).toBe(true);
      expect(access.isHidden('traces')).toBe(false);
    });

    it('lands on the home page even when it is hidden from visitors', () => {
      preferences.set(pages(['overview']));
      expect(access.landingPath()).toBe('/');
    });

    it('follows the session', () => {
      preferences.set(pages(['explore']));
      isAuthenticated.set(false);
      expect(access.canView('explore')).toBe(false);
    });
  });

  describe('landingPath()', () => {
    it('is "/" while the Career Overview is enabled', () => {
      preferences.set(pages(['explore']));
      expect(access.landingPath()).toBe('/');
    });

    it('is the first enabled page when the Career Overview is disabled', () => {
      preferences.set(pages(['overview', 'explore']));
      expect(access.landingPath()).toBe('/traces');
    });

    it('is the plain view when every page is disabled', () => {
      preferences.set(pages(ALL));
      expect(access.landingPath()).toBe('/resume');
    });

    it('updates when the preferences change', () => {
      preferences.set(pages(['overview']));
      expect(access.landingPath()).toBe('/explore');
      preferences.set(pages(['overview', 'explore']));
      expect(access.landingPath()).toBe('/traces');
    });
  });
});
