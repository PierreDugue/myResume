import type { Trace, TraceSummary } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('Traces API (seeded resume)', () => {
  let t: TestApp;
  let http: Api;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());

  it('lists the projects as traces, publicly', async () => {
    const res = await http.get('/api/traces');
    expect(res.status).toBe(200);
    const [site] = res.body as TraceSummary[];
    expect(site).toMatchObject({
      slug: 'pierre-o11y',
      title: 'Pierre O11y — this site',
      startDate: '2026-10-21',
      ongoing: true,
    });
    expect(site.spanCount).toBeGreaterThan(5);
    expect(site.tech).toContain('Angular');
  });

  it("draws this site's trace from the seeded build steps", async () => {
    const res = await http.get('/api/traces/pierre-o11y');
    expect(res.status).toBe(200);
    const trace = res.body as Trace;
    const [root, ...spans] = trace.spans;
    expect(root).toMatchObject({ depth: 0, name: 'Pierre O11y — this site', offset: 0, width: 1 });
    expect(root.endDate >= today).toBe(true);
    expect(spans[0]).toMatchObject({ depth: 1, name: 'Specification', startDate: '2026-10-21' });
    const features = spans.find((s) => s.name === 'Features');
    const explore = spans.find((s) => s.name === 'Explore (logs)');
    expect(explore).toMatchObject({ depth: 2, parentId: features?.id, startDate: '2026-10-23' });
    expect(explore?.tech.map((s) => s.name)).toContain('Angular');
    for (const s of spans) {
      expect(s.offset).toBeGreaterThanOrEqual(0);
      expect(s.offset + s.width).toBeLessThanOrEqual(1.0001);
    }
  });

  it('returns 404 for an unknown project', async () => {
    expect((await http.get('/api/traces/nope')).status).toBe(404);
  });

  it('returns 404 for a project without dates or spans', async () => {
    await http.post('/api/projects', { title: 'Someday', description: 'An idea.' });
    expect((await http.get('/api/traces/someday')).status).toBe(404);
    const list = (await http.get('/api/traces')).body as TraceSummary[];
    expect(list.map((s) => s.slug)).not.toContain('someday');
  });
});
