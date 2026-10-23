import type { DashboardResponse } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('GET /api/dashboard (seeded resume)', () => {
  let t: TestApp;
  let http: Api;
  const thisYear = new Date().getUTCFullYear();

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());

  const get = async (query = '') => {
    const res = await http.get(`/api/dashboard${query}`);
    return { status: res.status, body: res.body as DashboardResponse };
  };

  it('is public and covers the whole career by default', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.range).toEqual({ from: 2011, to: thisYear });
    expect(body.filters.minYear).toBe(2005);
    expect(body.applied).toEqual({ category: null, skill: null });
  });

  it('shows the headline figures and the current status', async () => {
    const { body } = await get();
    const stat = (key: string) => body.stats.find((s) => s.key === key);
    expect(stat('yearsInIt')?.display).toBe('14+');
    expect(stat('yearsOfAngular')?.display).toBe('9+');
    expect(stat('uptime')?.display).toBe('since 2011');
    expect(stat('jobs')?.value).toBe(8);
    expect(body.status).toEqual({ state: 'employed', company: 'Whoz', openToRelocation: true });
    expect(body.profile?.fullName).toBe('Pierre Dugue');
    expect(body.profile?.phone).toBeNull();
  });

  it('calculates skill usage from the seeded jobs, Angular first', async () => {
    const { body } = await get();
    expect(body.skillUsage.years[0]).toBe(2011);
    expect(body.skillUsage.series[0].name).toBe('Angular');
    const java = body.skillUsage.series.find((s) => s.name === 'Java/J2EE');
    // Capgemini Sep 2011–Jul 2013 (23 months) + LXA Mar 2014–Oct 2015 (20 months) = 43 months.
    expect(java?.totalYears).toBe(3.6);
    expect(body.skillTotals[0].category).toBe('Core Frameworks');
  });

  it('lists the timeline and the quantified achievements', async () => {
    const { body } = await get();
    expect(body.timeline[0]).toMatchObject({ kind: 'education', label: 'ESIL' });
    expect(body.timeline.at(-1)).toMatchObject({ kind: 'job', label: 'Whoz', endDate: null });
    expect(body.impacts.map((i) => i.impact.metric)).toContain('Page load time');
    expect(body.latestHighlights).toHaveLength(5);
  });

  it('applies the range and the filters', async () => {
    const window = (await get('?from=2017&to=2018')).body;
    expect(window.range).toEqual({ from: 2017, to: 2018 });
    expect(window.timeline.map((i) => i.label)).toEqual(['R3D', 'Fairfax Media', 'Isentia']);

    const java = (await get('?skill=java-j2ee')).body;
    expect(java.applied.skill).toBe('java-j2ee');
    expect(java.skillUsage.series.map((s) => s.name)).toEqual(['Java/J2EE']);

    const ai = (await get('?category=AI')).body;
    expect(new Set(ai.skillUsage.series.map((s) => s.category))).toEqual(new Set(['AI']));
  });

  it.each([
    ['a year that is not a number', '?from=abc'],
    ['from after to', '?from=2020&to=2010'],
    ['a year out of bounds', '?from=1800'],
    ['an unknown skill', '?skill=cobol'],
    ['an unknown category', '?category=Gardening'],
    ['an unknown parameter', '?foo=1'],
  ])('returns 400 for %s', async (_case, query) => {
    expect((await get(query)).status).toBe(400);
  });
});
