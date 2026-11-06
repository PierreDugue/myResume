import type { SitePreferences } from '@my-resume/api-models';
import { SitePreferencesEntity } from '../entities/site-preferences.entity';
import {
  sentOverviewPreferences,
  parseStoredSkillsOverTime,
  toSitePreferences,
  UpdateOverviewPreferencesDto,
} from './preferences.dto';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const ALL_ENABLED: SitePreferences = {
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
};

function entity(
  pages: Record<string, unknown>,
  overview: Record<string, unknown> = {},
): SitePreferencesEntity {
  return Object.assign(new SitePreferencesEntity(), {
    id: '00000000-0000-4000-8000-000000000001',
    pages,
    overview,
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
      overview: { skillsOverTime: [] },
    });
  });

  it('drops stored keys that are not page ids (any more), and never leaks row fields', () => {
    const result = toSitePreferences(entity({ resume: false, legacyPage: false, about: false }));
    expect(result).toEqual({ ...ALL_ENABLED, pages: { ...ALL_ENABLED.pages, about: false } });
    expect(Object.keys(result)).toEqual(['pages', 'overview']);
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

describe('toSitePreferences, overview', () => {
  it('has an empty skills selection by default (automatic)', () => {
    expect(toSitePreferences(null).overview).toEqual({ skillsOverTime: [] });
    expect(toSitePreferences(entity({}), []).overview).toEqual({ skillsOverTime: [] });
  });

  it('returns the resolved skill ids it is given, in that order', () => {
    expect(toSitePreferences(entity({}), [ID_B, ID_A]).overview).toEqual({
      skillsOverTime: [ID_B, ID_A],
    });
  });

  it('does not share the ids array or the default between calls', () => {
    const ids = [ID_A];
    const result = toSitePreferences(null, ids);
    result.overview.skillsOverTime.push(ID_B);
    expect(ids).toEqual([ID_A]);
    const first = toSitePreferences(null);
    first.overview.skillsOverTime.push(ID_A);
    expect(toSitePreferences(null).overview).toEqual({ skillsOverTime: [] });
  });
});

describe('parseStoredSkillsOverTime', () => {
  it('is empty without a row or without the key', () => {
    expect(parseStoredSkillsOverTime(null)).toEqual([]);
    expect(parseStoredSkillsOverTime(entity({}, {}))).toEqual([]);
  });

  it('returns the stored uuids', () => {
    expect(parseStoredSkillsOverTime(entity({}, { skillsOverTime: [ID_B, ID_A] }))).toEqual([
      ID_B,
      ID_A,
    ]);
  });

  it.each([
    ['a string', 'not-a-list'],
    ['an object', { 0: ID_A }],
    ['null', null],
    ['a number', 3],
  ])('ignores a stored value that is %s instead of an array', (_case, value) => {
    expect(parseStoredSkillsOverTime(entity({}, { skillsOverTime: value }))).toEqual([]);
  });

  it('drops items that are not uuid strings, and duplicates', () => {
    const stored = [ID_A, 7, null, 'abc', "x'); DROP TABLE skills;--", {}, ID_B, ID_A];
    expect(parseStoredSkillsOverTime(entity({}, { skillsOverTime: stored }))).toEqual([ID_A, ID_B]);
  });
});

describe('sentOverviewPreferences', () => {
  const dto = (skillsOverTime?: string[]) =>
    Object.assign(new UpdateOverviewPreferencesDto(), { skillsOverTime });

  it('is empty when nothing was sent', () => {
    expect(sentOverviewPreferences(undefined)).toEqual({});
    expect(sentOverviewPreferences(dto())).toEqual({});
  });

  it('keeps a sent list, including the empty one', () => {
    expect(sentOverviewPreferences(dto([ID_A]))).toEqual({ skillsOverTime: [ID_A] });
    expect(sentOverviewPreferences(dto([]))).toEqual({ skillsOverTime: [] });
  });
});
