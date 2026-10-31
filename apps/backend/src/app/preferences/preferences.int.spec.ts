import type { PagePreferences, PublicPageId, SitePreferences } from '@my-resume/api-models';
import request from 'supertest';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

const ALL_ENABLED: PagePreferences = {
  overview: true,
  explore: true,
  traces: true,
  serviceMap: true,
  quality: true,
  about: true,
};

const DISABLED = 'This page is disabled';

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
      expect(res.body as SitePreferences).toEqual({ pages: ALL_ENABLED });
    });

    it('ignores an invalid token (public route, never 401)', async () => {
      const res = await getAs('/api/preferences', 'Bearer not.a.jwt');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: ALL_ENABLED });
    });
  });

  describe('PATCH /api/preferences', () => {
    it('returns 401 without a token and changes nothing', async () => {
      const res = await http.patch('/api/preferences', { pages: { explore: false } }, false);
      expect(res.status).toBe(401);
      expect((await http.get('/api/preferences')).body).toEqual({ pages: ALL_ENABLED });
    });

    it('updates one page and returns the complete preferences (200)', async () => {
      const res = await http.patch('/api/preferences', { pages: { explore: false } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: { ...ALL_ENABLED, explore: false } });
      expect((await http.get('/api/preferences')).body).toEqual({
        pages: { ...ALL_ENABLED, explore: false },
      });
    });

    it('merges with what is stored: keys left out are kept', async () => {
      await http.patch('/api/preferences', { pages: { explore: false } });
      const res = await http.patch('/api/preferences', { pages: { quality: false } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: { ...ALL_ENABLED, explore: false, quality: false } });
    });

    it('can enable a page again', async () => {
      await http.patch('/api/preferences', { pages: { explore: false, traces: false } });
      const res = await http.patch('/api/preferences', { pages: { explore: true } });
      expect(res.body).toEqual({ pages: { ...ALL_ENABLED, traces: false } });
    });

    it('changes nothing for an empty body (200)', async () => {
      await http.patch('/api/preferences', { pages: { serviceMap: false } });
      const res = await http.patch('/api/preferences', {});
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: { ...ALL_ENABLED, serviceMap: false } });
    });

    it('changes nothing for an empty pages object (200)', async () => {
      const res = await http.patch('/api/preferences', { pages: {} });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pages: ALL_ENABLED });
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
      expect(res.body).toEqual({ pages: allDisabled });
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
      expect((await http.get('/api/preferences')).body).toEqual({ pages: ALL_ENABLED });
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
