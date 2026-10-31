import type { SitePreferences } from '@my-resume/api-models';
import { SitePreferencesEntity } from '../entities/site-preferences.entity';
import { toSitePreferences } from './preferences.dto';

const ALL_ENABLED: SitePreferences = {
  pages: {
    overview: true,
    explore: true,
    traces: true,
    serviceMap: true,
    quality: true,
    about: true,
  },
};

function entity(pages: Record<string, unknown>): SitePreferencesEntity {
  return Object.assign(new SitePreferencesEntity(), {
    id: '00000000-0000-4000-8000-000000000001',
    pages,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-02T00:00:00Z'),
  });
}

describe('toSitePreferences', () => {
  it('enables every page when nothing is stored yet (no row)', () => {
    expect(toSitePreferences(null)).toEqual(ALL_ENABLED);
  });

  it('enables every page when the row has no page flags', () => {
    expect(toSitePreferences(entity({}))).toEqual(ALL_ENABLED);
  });

  it('keeps the stored flags, true and false, and defaults the others to true', () => {
    expect(toSitePreferences(entity({ explore: false, quality: false, traces: true }))).toEqual({
      pages: { ...ALL_ENABLED.pages, explore: false, quality: false },
    });
  });

  it('drops stored keys that are not page ids (any more), and never leaks row fields', () => {
    const result = toSitePreferences(entity({ resume: false, legacyPage: false, about: false }));
    expect(result).toEqual({ pages: { ...ALL_ENABLED.pages, about: false } });
    expect(Object.keys(result)).toEqual(['pages']);
  });

  it('ignores stored values that are not booleans', () => {
    expect(toSitePreferences(entity({ explore: 'false', overview: null }))).toEqual(ALL_ENABLED);
  });

  it('returns a new object each time (the defaults are not shared)', () => {
    const first = toSitePreferences(null);
    first.pages.explore = false;
    expect(toSitePreferences(null)).toEqual(ALL_ENABLED);
  });
});
