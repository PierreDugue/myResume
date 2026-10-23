import type { Experience, LogLabel, LogsResponse, Skill } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('Logs API', () => {
  let t: TestApp;
  let http: Api;
  const thisYear = new Date().getUTCFullYear();

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());

  const logs = async (query = '') => {
    const res = await http.get(`/api/logs${query}`);
    return { status: res.status, body: res.body as LogsResponse, message: res.body.message };
  };
  const q = (query: string) => `?query=${encodeURIComponent(query)}`;

  describe('on the seeded resume', () => {
    it('is public and lists every line, newest first, over the whole career', async () => {
      const { status, body } = await logs();
      expect(status).toBe(200);
      expect(body.query).toBe('');
      expect(body.range).toEqual({ from: 2008, to: thisYear });
      expect(body.total).toBe(body.entries.length);
      const dates = body.entries.map((e) => e.date);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(body.volume.map((v) => v.year)[0]).toBe(2008);
      expect(body.volume.reduce((sum, v) => sum + v.total, 0)).toBe(body.total);
    });

    it('turns highlights and education into labelled lines', async () => {
      const { body } = await logs();
      const whoz = body.entries.find((e) => e.message === 'Generate 95% of code with Claude.');
      expect(whoz).toMatchObject({
        type: 'experience',
        level: 'achievement',
        source: 'Whoz',
        labels: { type: 'experience', level: 'achievement', company: 'Whoz' },
      });
      expect(body.entries.filter((e) => e.type === 'education').length).toBeGreaterThan(0);
    });

    it('tags the seeded highlights with the skills their message names', async () => {
      const { body } = await logs(q('|= "Refactored legacy codebase"'));
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].tech).toEqual(['Angular', 'NgRx']);
    });

    it('filters with the query language', async () => {
      const kx = (await logs(q('{company="kx", level="achievement"}'))).body;
      expect(kx.total).toBeGreaterThan(0);
      expect(kx.entries.every((e) => e.source === 'KX' && e.level === 'achievement')).toBe(true);

      const cypress = (await logs(q('{tech="Cypress"} |~ "coverage"'))).body;
      expect(cypress.entries.map((e) => e.source).sort()).toEqual(['KX', 'Winning Group']);

      const education = (await logs(q('{type="education"}'))).body;
      expect(education.entries.every((e) => e.type === 'education')).toBe(true);

      expect((await logs(q('no such thing anywhere'))).body.total).toBe(0);
    });

    it('applies the year range', async () => {
      const { body } = await logs('?from=2025&to=2025');
      expect(body.range).toEqual({ from: 2025, to: 2025 });
      expect(body.entries.every((e) => e.date.startsWith('2025'))).toBe(true);
      expect(body.volume).toHaveLength(1);
      expect(body.bounds).toEqual({ from: 2008, to: thisYear });
    });

    it('returns 400 with the column for an invalid query', async () => {
      const res = await logs(q('{company "KX"}'));
      expect(res.status).toBe(400);
      expect(res.message).toEqual(['Expected "=", "!=", "=~" or "!~" after "company" (column 10)']);
    });

    it('answers fast for a regular expression that would backtrack in other engines', async () => {
      const started = Date.now();
      const res = await logs(q('|~ ".*.*.*.*.*.*QQQ"'));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect((await logs(q('{role=~"(a|aa)*b"}'))).status).toBe(200);
      expect(Date.now() - started).toBeLessThan(2000);
    });

    it('returns 400 for regular expression syntax RE2 does not support', async () => {
      const res = await logs(q('|~ "(a)\\1"'));
      expect(res.status).toBe(400);
      expect(res.message[0]).toMatch(/^Invalid regular expression/);
    });

    it('treats JavaScript object properties as unknown labels, not as a crash', async () => {
      expect((await logs(q('{constructor="x"}'))).body).toMatchObject({ total: 0 });
      const all = (await logs()).body.total;
      expect((await logs(q('{__proto__=""}'))).body.total).toBe(all);
    });

    it.each([
      ['a year that is not a number', '?from=abc'],
      ['from after to', '?from=2020&to=2010'],
      ['a year out of bounds', '?to=2200'],
      ['an unknown parameter', '?foo=1'],
      ['a query sent twice', '?query=a&query=b'],
    ])('returns 400 for %s', async (_case, query) => {
      expect((await logs(query)).status).toBe(400);
    });

    it('lists the labels and their values for autocomplete', async () => {
      const res = await http.get('/api/logs/labels');
      expect(res.status).toBe(200);
      const labels = res.body as LogLabel[];
      expect(labels.slice(0, 2).map((l) => l.name)).toEqual(['type', 'level']);
      expect(labels.find((l) => l.name === 'type')?.values).toEqual([
        'education',
        'experience',
        'project',
      ]);
      expect(labels.find((l) => l.name === 'company')?.values).toContain('Whoz');
      expect(labels.find((l) => l.name === 'tech')?.values).toContain('Angular');
    });
  });

  it('shows the labels and skills the admin sets on a highlight', async () => {
    const skills = (await http.get('/api/skills')).body as Skill[];
    const nestjs = skills.find((s) => s.name === 'NestJS') as Skill;
    const [whoz] = (await http.get('/api/experiences')).body as Experience[];
    const highlights = whoz.highlights.map(({ id, date, level, message, impact }) => ({
      id,
      date,
      level,
      message,
      impact,
    }));
    highlights[0] = {
      ...highlights[0],
      labels: { team: 'observability' },
      skillIds: [nestjs.id],
    } as never;
    expect((await http.patch(`/api/experiences/${whoz.id}`, { highlights })).status).toBe(200);

    const { body } = await logs(q('{team="observability", tech="nestjs"}'));
    expect(body.entries.map((e) => e.id)).toEqual([whoz.highlights[0].id]);
    expect(body.entries[0].labels['team']).toBe('observability');
    const labels = (await http.get('/api/logs/labels')).body as LogLabel[];
    expect(labels.find((l) => l.name === 'team')?.values).toEqual(['observability']);
  });
});
