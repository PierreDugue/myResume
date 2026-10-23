import type { ServiceMapResponse } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('Service map API (seeded resume)', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());

  it('links the jobs and projects to their technologies, publicly', async () => {
    const res = await http.get('/api/service-map');
    expect(res.status).toBe(200);
    const { nodes, edges } = res.body as ServiceMapResponse;

    const jobs = nodes.filter((n) => n.kind === 'job');
    expect(jobs).toHaveLength(8);
    expect(jobs[0]).toMatchObject({ label: 'Whoz', slug: null });
    expect(nodes.filter((n) => n.kind === 'project').map((n) => n.slug)).toEqual(['pierre-o11y']);

    const angular = nodes.find((n) => n.label === 'Angular');
    expect(angular).toMatchObject({ kind: 'skill', slug: 'angular', category: 'Core Frameworks' });
    expect(angular?.years).toBeGreaterThan(5);

    const ids = new Set(nodes.map((n) => n.id));
    expect(edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
    expect(edges).toContainEqual({ source: jobs[0].id, target: angular?.id });
    // Every skill node is linked.
    for (const skill of nodes.filter((n) => n.kind === 'skill')) {
      expect(edges.some((e) => e.target === skill.id)).toBe(true);
    }
  });
});
