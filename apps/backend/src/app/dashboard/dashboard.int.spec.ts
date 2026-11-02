import type { DashboardResponse } from '@my-resume/api-models';
import { SKILLS_OVER_TIME_MAX } from '@my-resume/resume-metrics';
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

  describe('skills over time', () => {
    const select = (ids: string[]) =>
      http.patch('/api/preferences', { overview: { skillsOverTime: ids } });
    const reset = () => t.dataSource.query('DELETE FROM "site_preferences"');
    beforeEach(reset);
    afterEach(reset);

    it('is automatic without a selection: the first 8 of skillUsage', async () => {
      const { body } = await get();
      expect(body.skillUsage.series.length).toBeGreaterThan(SKILLS_OVER_TIME_MAX);
      expect(body.skillsOverTime.mode).toBe('auto');
      expect(body.skillsOverTime.years).toEqual(body.skillUsage.years);
      expect(body.skillsOverTime.series).toEqual(
        body.skillUsage.series.slice(0, SKILLS_OVER_TIME_MAX),
      );
    });

    it('shows the selection, in usage order and not in the order sent', async () => {
      const before = (await get()).body;
      const usage = before.skillUsage.series;
      // Not among the top 8, the least used, and the most used.
      const picked = [usage[usage.length - 1], usage[0], usage[2]];
      expect((await select(picked.map((s) => s.skillId))).status).toBe(200);

      const { body } = await get();
      expect(body.skillsOverTime.mode).toBe('selected');
      expect(body.skillsOverTime.series.map((s) => s.skillId)).toEqual([
        usage[0].skillId,
        usage[2].skillId,
        usage[usage.length - 1].skillId,
      ]);
      expect(body.skillsOverTime.series[0]).toEqual(usage[0]);
      expect(body.skillUsage).toEqual(before.skillUsage);
      expect(body.skillTotals).toEqual(before.skillTotals);
    });

    it('keeps only the selected skills that the category filter leaves', async () => {
      const usage = (await get()).body.skillUsage.series;
      const ai = usage.filter((s) => s.category === 'AI');
      const other = usage.find((s) => s.category !== 'AI');
      expect(ai.length).toBeGreaterThan(0);
      expect(other).toBeDefined();
      await select([other?.skillId as string, ai[0].skillId]);

      const { body } = await get('?category=AI');
      expect(body.skillsOverTime.mode).toBe('selected');
      expect(body.skillsOverTime.series.map((s) => s.skillId)).toEqual([ai[0].skillId]);
    });

    it('falls back to the most used skills when a filter keeps none of the selection', async () => {
      const usage = (await get()).body.skillUsage.series;
      const other = usage.find((s) => s.category !== 'AI');
      await select([other?.skillId as string]);

      expect((await get()).body.skillsOverTime.mode).toBe('selected');
      const { body } = await get('?category=AI');
      expect(body.skillsOverTime.mode).toBe('auto');
      expect(body.skillsOverTime.series).toEqual(
        body.skillUsage.series.slice(0, SKILLS_OVER_TIME_MAX),
      );
      expect(body.skillsOverTime.series.length).toBeGreaterThan(0);
    });

    it('applies the skill filter and the range to the selection', async () => {
      const usage = (await get()).body.skillUsage.series;
      await select([usage[0].skillId, usage[1].skillId]);

      const bySkill = (await get(`?skill=${usage[1].slug}`)).body;
      expect(bySkill.skillsOverTime.mode).toBe('selected');
      expect(bySkill.skillsOverTime.series.map((s) => s.skillId)).toEqual([usage[1].skillId]);

      const window = (await get('?from=2011&to=2011')).body;
      expect(window.skillsOverTime.years).toEqual([2011]);
      const used = new Set(window.skillUsage.series.map((s) => s.skillId));
      for (const line of window.skillsOverTime.series) expect(used.has(line.skillId)).toBe(true);
    });

    it('drops a deleted skill from the selection and falls back to automatic', async () => {
      const { body: temp } = await http.post('/api/skills', { name: 'Temp skill', category: 'x' });
      await select([temp.id]);
      await http.delete(`/api/skills/${temp.id}`);

      const { body } = await get();
      expect(body.skillsOverTime.mode).toBe('auto');
      expect(body.skillsOverTime.series).toHaveLength(SKILLS_OVER_TIME_MAX);
    });

    it('goes back to automatic when the selection is reset', async () => {
      const usage = (await get()).body.skillUsage.series;
      await select([usage[3].skillId]);
      expect((await get()).body.skillsOverTime.mode).toBe('selected');
      await select([]);
      expect((await get()).body.skillsOverTime.mode).toBe('auto');
    });
  });
});
