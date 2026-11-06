import type { ProcessMetricsHistory, ProcessSample } from '@my-resume/api-models';
import request from 'supertest';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DISABLED = 'This page is disabled';

const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

describe('GET /api/site-metrics/process', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
    // The service samples once per second from startup: wait for a few samples.
    await new Promise((resolve) => setTimeout(resolve, 3200));
  });
  afterAll(() => t?.close());
  beforeEach(() => t.dataSource.query('DELETE FROM "site_preferences"'));

  const get = async (query = '') => {
    const res = await http.get(`/api/site-metrics/process${query}`);
    return { status: res.status, body: res.body as ProcessMetricsHistory };
  };

  it('is public and returns the buffered history, oldest first', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.intervalMs).toBe(1000);
    expect(body.startedAt).toMatch(ISO);
    expect(Date.parse(body.startedAt)).toBeLessThanOrEqual(Date.now());
    expect(body.samples.length).toBeGreaterThanOrEqual(2);
    expect(body.samples.length).toBeLessThanOrEqual(300);
    const ts = body.samples.map((s) => Date.parse(s.ts));
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('returns samples with only the contract fields, as rounded numbers', async () => {
    const { body } = await get();
    const sample = body.samples.at(-1) as ProcessSample;
    expect(Object.keys(sample).sort()).toEqual(
      ['cpuPercent', 'eventLoopLagMs', 'gc', 'memoryMb', 'ts', 'uptimeSeconds'].sort(),
    );
    expect(sample.ts).toMatch(ISO);
    expect(Number.isInteger(sample.uptimeSeconds)).toBe(true);
    expect(Object.keys(sample.eventLoopLagMs).sort()).toEqual(['p50', 'p99']);
    expect(Object.keys(sample.memoryMb).sort()).toEqual(['heapTotal', 'heapUsed', 'rss']);
    expect(Object.keys(sample.gc).sort()).toEqual([
      'majorCount',
      'majorMs',
      'minorCount',
      'minorMs',
    ]);
    expect(sample.memoryMb.rss).toBeGreaterThan(1);
    for (const v of Object.values(sample.memoryMb)) expect(decimals(v)).toBeLessThanOrEqual(1);
    for (const v of Object.values(sample.eventLoopLagMs)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(decimals(v)).toBeLessThanOrEqual(2);
    }
    expect(sample.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(decimals(sample.cpuPercent)).toBeLessThanOrEqual(1);
    expect(Number.isInteger(sample.gc.minorCount)).toBe(true);
    expect(Number.isInteger(sample.gc.majorCount)).toBe(true);
    expect(decimals(sample.gc.minorMs)).toBeLessThanOrEqual(2);
    expect(decimals(sample.gc.majorMs)).toBeLessThanOrEqual(2);
  });

  it('returns only the samples strictly after `since`', async () => {
    const all = (await get()).body.samples;
    const cursor = all[0].ts;
    const { status, body } = await get(`?since=${encodeURIComponent(cursor)}`);
    expect(status).toBe(200);
    expect(body.samples.length).toBeGreaterThanOrEqual(all.length - 1);
    expect(body.samples.every((s) => Date.parse(s.ts) > Date.parse(cursor))).toBe(true);
    expect(body.samples.map((s) => s.ts)).not.toContain(cursor);
  });

  it('returns the whole buffer for a `since` older than the buffer', async () => {
    const { body } = await get('?since=2000-01-01T00:00:00.000Z');
    expect(body.samples.length).toBeGreaterThanOrEqual(2);
    expect(body.samples[0].ts).toBe((await get()).body.samples[0].ts);
  });

  it('returns no samples for a `since` in the future', async () => {
    const { status, body } = await get('?since=2999-01-01T00:00:00.000Z');
    expect(status).toBe(200);
    expect(body).toMatchObject({ intervalMs: 1000, samples: [] });
  });

  it.each([
    ['an unparseable value', 'yesterday'],
    ['an empty value', ''],
    ['a value longer than 40 characters', `2026-11-05T10:00:00.${'0'.repeat(30)}Z`],
    ['a time without an offset', '2026-11-05T10:00:00'],
    ['a repeated parameter', '2026-11-05T10:00:00Z&since=2026-11-05T10:00:01Z'],
  ])('returns 400 for %s', async (_case, since) => {
    const res = await http.get(`/api/site-metrics/process?since=${since}`);
    expect(res.status).toBe(400);
  });

  it.each([
    ['a date only (midnight UTC)', '2999-01-01'],
    ['a timestamp with a numeric offset', encodeURIComponent('2999-01-01T12:00:00+02:00')],
  ])('accepts %s as `since`', async (_case, since) => {
    const { status, body } = await get(`?since=${since}`);
    expect(status).toBe(200);
    expect(body.samples).toEqual([]);
  });

  it('returns 400 for unknown query parameters', async () => {
    expect((await http.get('/api/site-metrics/process?limit=5')).status).toBe(400);
  });

  it('ignores an invalid token (public route, never 401)', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/api/site-metrics/process')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(200);
  });

  it('is refused to visitors (404) while siteMetrics is disabled, and served to the admin', async () => {
    await http.patch('/api/preferences', { pages: { siteMetrics: false } });

    const visitor = await http.get('/api/site-metrics/process');
    expect(visitor.status).toBe(404);
    expect(visitor.body).toEqual({ statusCode: 404, message: DISABLED, error: 'Not Found' });

    const admin = await http.get('/api/site-metrics/process', true);
    expect(admin.status).toBe(200);
    expect(admin.body.intervalMs).toBe(1000);

    await http.patch('/api/preferences', { pages: { siteMetrics: true } });
    expect((await http.get('/api/site-metrics/process')).status).toBe(200);
  });

  it('only refuses the disabled page', async () => {
    await http.patch('/api/preferences', { pages: { quality: false } });
    expect((await get()).status).toBe(200);
  });

  it('accepts siteMetrics in the preferences and returns it', async () => {
    const res = await http.patch('/api/preferences', { pages: { siteMetrics: false } });
    expect(res.status).toBe(200);
    expect(res.body.pages.siteMetrics).toBe(false);
    expect((await http.get('/api/preferences')).body.pages.siteMetrics).toBe(false);
  });
});
