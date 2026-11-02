import type {
  OverviewPreferences,
  PagePreferences,
  PublicPageId,
  Skill,
  SitePreferences,
} from '@my-resume/api-models';
import { SKILLS_OVER_TIME_MAX } from '@my-resume/resume-metrics';
import { vi } from 'vitest';
import request from 'supertest';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';
import { SkillsService } from '../skills/skills.service';
import { PreferencesService } from './preferences.service';

const ALL_ENABLED: PagePreferences = {
  overview: true,
  explore: true,
  traces: true,
  serviceMap: true,
  quality: true,
  about: true,
};

const DISABLED = 'This page is disabled';
const NO_SELECTION: OverviewPreferences = { skillsOverTime: [] };
const MISSING = '00000000-0000-4000-8000-000000000000';

describe('Preferences API', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  // A missing row means "all defaults".
  beforeEach(() => t.dataSource.query('DELETE FROM "site_preferences"'));

  const getAs = (url: string, authorization: string) =>
    request(t.app.getHttpServer()).get(url).set('Authorization', authorization);

  describe('GET /api/preferences', () => {
    it('is public and enables every page by default', async () => {
      const res = await http.get('/api/preferences');
      expect(res.status).toBe(200);
      expect(res.body as SitePreferences).toEqual({ pages: ALL_ENABLED, overview: NO_SELECTION });
    });

    it('ignores an invalid token (public route, never 401)', async () => {
      const res = await getAs('/api/preferences', 'Bearer not.a.jwt');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: ALL_ENABLED, overview: NO_SELECTION });
    });
  });

  describe('PATCH /api/preferences', () => {
    it('returns 401 without a token and changes nothing', async () => {
      const res = await http.patch('/api/preferences', { pages: { explore: false } }, false);
      expect(res.status).toBe(401);
      expect((await http.get('/api/preferences')).body).toEqual({
        pages: ALL_ENABLED,
        overview: NO_SELECTION,
      });
    });

    it('updates one page and returns the complete preferences (200)', async () => {
      const res = await http.patch('/api/preferences', { pages: { explore: false } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pages: { ...ALL_ENABLED, explore: false },
        overview: NO_SELECTION,
      });
      expect((await http.get('/api/preferences')).body).toEqual({
        pages: { ...ALL_ENABLED, explore: false },
        overview: NO_SELECTION,
      });
    });

    it('merges with what is stored: keys left out are kept', async () => {
      await http.patch('/api/preferences', { pages: { explore: false } });
      const res = await http.patch('/api/preferences', { pages: { quality: false } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pages: { ...ALL_ENABLED, explore: false, quality: false },
        overview: NO_SELECTION,
      });
    });

    it('can enable a page again', async () => {
      await http.patch('/api/preferences', { pages: { explore: false, traces: false } });
      const res = await http.patch('/api/preferences', { pages: { explore: true } });
      expect(res.body).toEqual({
        pages: { ...ALL_ENABLED, traces: false },
        overview: NO_SELECTION,
      });
    });

    it('changes nothing for an empty body (200)', async () => {
      await http.patch('/api/preferences', { pages: { serviceMap: false } });
      const res = await http.patch('/api/preferences', {});
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pages: { ...ALL_ENABLED, serviceMap: false },
        overview: NO_SELECTION,
      });
    });

    it('changes nothing for an empty pages object (200)', async () => {
      const res = await http.patch('/api/preferences', { pages: {} });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: ALL_ENABLED, overview: NO_SELECTION });
    });

    it('allows every page to be disabled', async () => {
      const allDisabled: PagePreferences = {
        overview: false,
        explore: false,
        traces: false,
        serviceMap: false,
        quality: false,
        about: false,
      };
      const res = await http.patch('/api/preferences', { pages: allDisabled });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: allDisabled, overview: NO_SELECTION });
    });

    describe('concurrency and the single row', () => {
      const countRows = async () =>
        Number((await t.dataSource.query('SELECT count(*) AS n FROM "site_preferences"'))[0].n);

      it('keeps one row and both keys for concurrent first PATCHes on an empty table', async () => {
        const [a, b] = await Promise.all([
          http.patch('/api/preferences', { pages: { explore: false } }),
          http.patch('/api/preferences', { pages: { quality: false } }),
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(await countRows()).toBe(1);
        expect((await http.get('/api/preferences')).body).toEqual({
          pages: { ...ALL_ENABLED, explore: false, quality: false },
          overview: NO_SELECTION,
        });
      });

      it('keeps both keys for concurrent PATCHes when the row exists', async () => {
        await http.patch('/api/preferences', { pages: { about: false } });
        const [a, b] = await Promise.all([
          http.patch('/api/preferences', { pages: { explore: false } }),
          http.patch('/api/preferences', { pages: { quality: false } }),
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        expect(await countRows()).toBe(1);
        expect((await http.get('/api/preferences')).body).toEqual({
          pages: { ...ALL_ENABLED, about: false, explore: false, quality: false },
          overview: NO_SELECTION,
        });
      });

      it('refuses a second row at the database level', async () => {
        await http.patch('/api/preferences', { pages: { explore: false } });
        await expect(
          t.dataSource.query(`INSERT INTO "site_preferences" ("pages") VALUES ('{}')`),
        ).rejects.toThrow(/UQ_site_preferences_singleton/);
        expect(await countRows()).toBe(1);
      });
    });

    it.each([
      ['an unknown page id', { pages: { resume: false } }],
      ['an unknown page id next to a known one', { pages: { explore: false, resume: false } }],
      ['an unknown group', { theme: 'dark' }],
      ['a string instead of a boolean', { pages: { explore: 'false' } }],
      ['a number instead of a boolean', { pages: { explore: 1 } }],
      ['null for a page', { pages: { explore: null } }],
      ['null for pages', { pages: null }],
      ['a boolean for pages', { pages: false }],
      ['an array for pages', { pages: [{ explore: false }] }],
    ])('returns 400 for %s and changes nothing', async (_case, body) => {
      const res = await http.patch('/api/preferences', body);
      expect(res.status).toBe(400);
      expect((await http.get('/api/preferences')).body).toEqual({
        pages: ALL_ENABLED,
        overview: NO_SELECTION,
      });
    });
  });

  describe('overview: skills over time', () => {
    let skills: Skill[];
    let ids: string[]; // all skill ids, in skills-list order
    const selection = async () =>
      ((await http.get('/api/preferences')).body as SitePreferences).overview.skillsOverTime;

    beforeAll(async () => {
      skills = (await http.get('/api/skills')).body as Skill[];
      ids = skills.map((s) => s.id);
      expect(ids.length).toBeGreaterThan(SKILLS_OVER_TIME_MAX); // seeded database
    });

    it('is automatic by default', async () => {
      const res = await http.get('/api/preferences');
      expect((res.body as SitePreferences).overview).toEqual({ skillsOverTime: [] });
    });

    it('stores a selection and returns it in skills-list order, whatever order was sent', async () => {
      const sent = [ids[5], ids[0], ids[3]];
      const res = await http.patch('/api/preferences', { overview: { skillsOverTime: sent } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pages: ALL_ENABLED,
        overview: { skillsOverTime: [ids[0], ids[3], ids[5]] },
      });
      expect(await selection()).toEqual([ids[0], ids[3], ids[5]]);
    });

    it('follows a reordering of the skills list', async () => {
      await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[0], ids[1]] } });
      await http.put('/api/skills/order', { ids: [...ids.slice(1), ids[0]] });
      try {
        expect(await selection()).toEqual([ids[1], ids[0]]);
      } finally {
        await http.put('/api/skills/order', { ids });
      }
    });

    it('accepts the maximum of 8 skills', async () => {
      const res = await http.patch('/api/preferences', {
        overview: { skillsOverTime: ids.slice(0, SKILLS_OVER_TIME_MAX) },
      });
      expect(res.status).toBe(200);
      expect(await selection()).toEqual(ids.slice(0, SKILLS_OVER_TIME_MAX));
    });

    it('replaces the whole list, and [] goes back to automatic', async () => {
      await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[0], ids[1]] } });
      const replaced = await http.patch('/api/preferences', {
        overview: { skillsOverTime: [ids[2]] },
      });
      expect(replaced.body.overview).toEqual({ skillsOverTime: [ids[2]] });

      const reset = await http.patch('/api/preferences', { overview: { skillsOverTime: [] } });
      expect(reset.status).toBe(200);
      expect(reset.body.overview).toEqual({ skillsOverTime: [] });
      expect(await selection()).toEqual([]);
    });

    it('keeps the selection when only pages are sent, and the pages when only overview is sent', async () => {
      await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[1]] } });
      const pagesOnly = await http.patch('/api/preferences', { pages: { explore: false } });
      expect(pagesOnly.body).toEqual({
        pages: { ...ALL_ENABLED, explore: false },
        overview: { skillsOverTime: [ids[1]] },
      });

      const overviewOnly = await http.patch('/api/preferences', {
        overview: { skillsOverTime: [ids[2]] },
      });
      expect(overviewOnly.body).toEqual({
        pages: { ...ALL_ENABLED, explore: false },
        overview: { skillsOverTime: [ids[2]] },
      });
    });

    it('keeps the selection for an empty body or an empty overview object', async () => {
      await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[1]] } });
      expect((await http.patch('/api/preferences', {})).body.overview).toEqual({
        skillsOverTime: [ids[1]],
      });
      const res = await http.patch('/api/preferences', { overview: {} });
      expect(res.status).toBe(200);
      expect(res.body.overview).toEqual({ skillsOverTime: [ids[1]] });
    });

    it('creates the row with a selection and default pages on an empty table', async () => {
      const res = await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[0]] } });
      expect(res.body).toEqual({ pages: ALL_ENABLED, overview: { skillsOverTime: [ids[0]] } });
    });

    it('silently drops a deleted skill from the selection (no write needed)', async () => {
      const { body: temp } = await http.post('/api/skills', { name: 'Temp skill', category: 'x' });
      try {
        await http.patch('/api/preferences', {
          overview: { skillsOverTime: [ids[0], temp.id] },
        });
        expect(await selection()).toEqual([ids[0], temp.id]);
        expect((await http.delete(`/api/skills/${temp.id}`)).status).toBe(204);
        expect(await selection()).toEqual([ids[0]]);
        const [row] = await t.dataSource.query('SELECT "overview" FROM "site_preferences"');
        expect(row.overview.skillsOverTime).toContain(temp.id); // dropped on read only
      } finally {
        await http.delete(`/api/skills/${temp.id}`);
      }
    });

    describe('storedSkillsOverTime() (read by the dashboard)', () => {
      const service = () => t.app.get(PreferencesService);

      it('is empty when no row exists', async () => {
        expect(await service().storedSkillsOverTime()).toEqual([]);
      });

      it('returns the stored ids without looking up the skills (buildDashboard ignores unknown ids)', async () => {
        await http.patch('/api/preferences', { overview: { skillsOverTime: [ids[2], ids[0]] } });
        await t.dataSource.query(
          `UPDATE "site_preferences" SET "overview" = jsonb_build_object('skillsOverTime', jsonb_build_array($1::text, $2::text, $3::text))`,
          [ids[2], MISSING, ids[0]],
        );
        const skills = t.app.get(SkillsService);
        const existingIds = vi.spyOn(skills, 'existingIds');
        const findByIds = vi.spyOn(skills, 'findByIdsOrFail');
        try {
          expect(await service().storedSkillsOverTime()).toEqual([ids[2], MISSING, ids[0]]);
          expect(existingIds).not.toHaveBeenCalled();
          expect(findByIds).not.toHaveBeenCalled();
        } finally {
          existingIds.mockRestore();
          findByIds.mockRestore();
        }
      });
    });

    it('ignores malformed values already stored (never fails, never reaches the SQL)', async () => {
      const cases: [unknown, string[]][] = [
        ['nope', []],
        [null, []],
        [{ 0: 'x' }, []],
        [[7, null, "'); DROP TABLE skills;--", ids[0], ids[0]], [ids[0]]],
      ];
      for (const [stored, expected] of cases) {
        await t.dataSource.query('DELETE FROM "site_preferences"');
        await t.dataSource.query(`INSERT INTO "site_preferences" ("overview") VALUES ($1::jsonb)`, [
          JSON.stringify({ skillsOverTime: stored }),
        ]);
        const res = await http.get('/api/preferences');
        expect(res.status).toBe(200);
        expect(res.body.overview.skillsOverTime, JSON.stringify(stored)).toEqual(expected);
      }
    });

    it('returns 401 without a token and changes nothing', async () => {
      const res = await http.patch(
        '/api/preferences',
        { overview: { skillsOverTime: [ids[0]] } },
        false,
      );
      expect(res.status).toBe(401);
      expect(await selection()).toEqual([]);
    });

    it.each<[string, () => unknown]>([
      ['9 ids', () => ({ overview: { skillsOverTime: ids.slice(0, SKILLS_OVER_TIME_MAX + 1) } })],
      ['duplicate ids', () => ({ overview: { skillsOverTime: [ids[0], ids[0]] } })],
      ['an id that is not a uuid', () => ({ overview: { skillsOverTime: ['angular'] } })],
      ['a number in the list', () => ({ overview: { skillsOverTime: [1] } })],
      ['an unknown skill id', () => ({ overview: { skillsOverTime: [ids[0], MISSING] } })],
      ['null for overview', () => ({ overview: null })],
      ['a string for overview', () => ({ overview: 'x' })],
      ['an array for overview', () => ({ overview: [] })],
      ['null for skillsOverTime', () => ({ overview: { skillsOverTime: null } })],
      ['a string for skillsOverTime', () => ({ overview: { skillsOverTime: ids[0] } })],
      ['an object for skillsOverTime', () => ({ overview: { skillsOverTime: {} } })],
      ['an unknown key in overview', () => ({ overview: { skillsOverTime: [], theme: 'dark' } })],
      [
        'valid pages next to an invalid overview',
        () => ({ pages: { explore: false }, overview: { skillsOverTime: [MISSING] } }),
      ],
      [
        'valid pages next to too many skills',
        () => ({
          pages: { explore: false },
          overview: { skillsOverTime: ids.slice(0, SKILLS_OVER_TIME_MAX + 1) },
        }),
      ],
    ])('returns 400 for %s and changes nothing', async (_case, body) => {
      await http.patch('/api/preferences', {
        pages: { quality: false },
        overview: { skillsOverTime: [ids[1]] },
      });
      const before = (await http.get('/api/preferences')).body;

      const res = await http.patch('/api/preferences', body() as object);
      expect(res.status).toBe(400);
      expect((await http.get('/api/preferences')).body).toEqual(before);
    });

    it('answers "Unknown skill ids" for a uuid that is not a skill', async () => {
      const res = await http.patch('/api/preferences', { overview: { skillsOverTime: [MISSING] } });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Unknown skill ids');
    });
  });

  describe('disabled pages', () => {
    const gated: [string, PublicPageId][] = [
      ['/api/dashboard', 'overview'],
      ['/api/logs', 'explore'],
      ['/api/logs/labels', 'explore'],
      ['/api/traces', 'traces'],
      ['/api/traces/pierre-o11y', 'traces'],
      ['/api/service-map', 'serviceMap'],
      ['/api/quality', 'quality'],
    ];

    it.each(gated)('%s is refused to visitors while %s is disabled', async (url, page) => {
      // The normal answer (some are legitimately 404 in tests, e.g. no quality report).
      const normal = await http.get(url);
      expect(normal.body.message).not.toBe(DISABLED);

      await http.patch('/api/preferences', { pages: { [page]: false } });

      const visitor = await http.get(url);
      expect(visitor.status).toBe(404);
      expect(visitor.body).toEqual({ statusCode: 404, message: DISABLED, error: 'Not Found' });

      for (const header of ['Bearer not.a.jwt', 'Bearer ', 'Basic abc', t.token]) {
        const res = await getAs(url, header);
        expect(res.status, header).toBe(404);
        expect(res.body.message, header).toBe(DISABLED);
      }

      const admin = await http.get(url, true);
      expect(admin.status).toBe(normal.status);
      expect(admin.body).toEqual(normal.body);

      await http.patch('/api/preferences', { pages: { [page]: true } });
      const again = await http.get(url);
      expect(again.status).toBe(normal.status);
      expect(again.body).toEqual(normal.body);
    });

    it('only refuses the disabled page', async () => {
      await http.patch('/api/preferences', { pages: { explore: false } });
      expect((await http.get('/api/traces')).status).toBe(200);
      expect((await http.get('/api/service-map')).status).toBe(200);
      expect((await http.get('/api/dashboard')).status).toBe(200);
    });

    it('never refuses GET /api/resume, even with every page disabled', async () => {
      await http.patch('/api/preferences', {
        pages: {
          overview: false,
          explore: false,
          traces: false,
          serviceMap: false,
          quality: false,
          about: false,
        },
      });
      expect((await http.get('/api/resume')).status).toBe(200);
      expect((await http.get('/api/preferences')).status).toBe(200);
    });
  });
});
