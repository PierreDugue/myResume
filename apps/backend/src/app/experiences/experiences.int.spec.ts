import type { Experience, Skill } from '@my-resume/api-models';
import { Api, api, createTestApp, MISSING_ID, TestApp, UUID } from '../../testing/test-app';

describe('Experiences API', () => {
  let t: TestApp;
  let http: Api;
  let angular: Skill;
  let ngrx: Skill;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  beforeEach(async () => {
    await t.truncateContent();
    angular = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
    ngrx = (await http.post('/api/skills', { name: 'NgRx', category: 'State' })).body;
  });

  const kx = () => ({
    company: 'KX',
    role: 'Angular Front-End Engineer',
    location: 'Full Remote',
    startDate: '2022-09-01',
    endDate: '2025-11-30',
    summary: 'Led front-end development of a data visualization platform.',
    skillIds: [angular.id, ngrx.id],
    highlights: [
      {
        date: '2025-11-30',
        level: 'achievement',
        message: 'Refactored legacy code with NgRx and Signals, cutting page load time by 35%.',
        impact: {
          metric: 'Page load time',
          before: null,
          after: null,
          changePct: -35,
          unit: '%',
          direction: 'down-is-good',
        },
      },
      { date: '2025-11-30', level: 'info', message: 'Introduced an NX monorepo.' },
    ],
  });
  const create = (body: object) => http.post('/api/experiences', body);

  it('creates an experience with its skills and ordered highlights (201)', async () => {
    const res = await create(kx());
    expect(res.status).toBe(201);
    const exp = res.body as Experience;
    expect(exp).toMatchObject({
      id: expect.stringMatching(UUID),
      company: 'KX',
      startDate: '2022-09-01',
      endDate: '2025-11-30',
      sortOrder: 0,
    });
    expect(exp.skillIds.sort()).toEqual([angular.id, ngrx.id].sort());
    expect(exp.highlights).toHaveLength(2);
    expect(exp.highlights[0]).toMatchObject({
      id: expect.stringMatching(UUID),
      level: 'achievement',
      sortOrder: 0,
      impact: { changePct: -35, direction: 'down-is-good' },
    });
    expect(exp.highlights[1]).toMatchObject({
      message: 'Introduced an NX monorepo.',
      impact: null,
      sortOrder: 1,
    });
  });

  it('applies defaults: no end date (current job), no skills, no highlights', async () => {
    const res = await create({ company: 'Whoz', role: 'Engineer', startDate: '2026-05-01' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      endDate: null,
      location: null,
      summary: null,
      skillIds: [],
      highlights: [],
    });
  });

  it('lists the skills of an experience in the order of the skills list', async () => {
    const jest = (await http.post('/api/skills', { name: 'Jest', category: 'Testing' })).body;
    const exp = (await create({ ...kx(), skillIds: [jest.id, ngrx.id, angular.id] }))
      .body as Experience;
    expect(exp.skillIds).toEqual([angular.id, ngrx.id, jest.id]);

    await http.put('/api/skills/order', { ids: [jest.id, angular.id, ngrx.id] });
    const [listed] = (await http.get('/api/experiences')).body as Experience[];
    expect(listed.skillIds).toEqual([jest.id, angular.id, ngrx.id]);
  });

  it('lists experiences publicly with their highlights in order', async () => {
    await create(kx());
    await create({ company: 'Whoz', role: 'Engineer', startDate: '2026-05-01' });
    const list = (await http.get('/api/experiences')).body as Experience[];
    expect(list.map((e) => e.company)).toEqual(['KX', 'Whoz']);
    expect(list[0].highlights.map((h) => h.sortOrder)).toEqual([0, 1]);
  });

  it.each([
    ['an end date before the start date', { endDate: '2021-01-01' }],
    ['an invalid date', { startDate: '2022-13-01' }],
    ['a date in another format', { startDate: '01/09/2022' }],
    ['an unknown skill id', { skillIds: [MISSING_ID] }],
    [
      'a highlight with an unknown level',
      { highlights: [{ date: '2025-01-01', level: 'epic', message: 'x' }] },
    ],
    ['a highlight without a message', { highlights: [{ date: '2025-01-01', level: 'info' }] }],
    [
      'an impact with an unknown direction',
      {
        highlights: [
          {
            date: '2025-01-01',
            level: 'info',
            message: 'x',
            impact: {
              metric: 'm',
              before: null,
              after: null,
              changePct: 1,
              unit: null,
              direction: 'sideways',
            },
          },
        ],
      },
    ],
    ['a missing company', { company: undefined }],
  ])('returns 400 for %s', async (_case, override) => {
    expect((await create({ ...kx(), ...override })).status).toBe(400);
  });

  it('replaces the highlights on PATCH: keeps ids it is given, creates new ones, deletes the rest', async () => {
    const exp = (await create(kx())).body as Experience;
    const [first, second] = exp.highlights;

    const res = await http.patch(`/api/experiences/${exp.id}`, {
      highlights: [
        { date: '2024-01-01', level: 'milestone', message: 'Brand new first' },
        {
          id: first.id,
          date: first.date,
          level: first.level,
          message: 'Edited',
          impact: first.impact,
        },
      ],
    });
    expect(res.status).toBe(200);
    const updated = (res.body as Experience).highlights;
    expect(updated.map((h) => h.message)).toEqual(['Brand new first', 'Edited']);
    expect(updated[1].id).toBe(first.id);
    expect(updated.map((h) => h.id)).not.toContain(second.id);
    const [{ count }] = await t.dataSource.query('SELECT count(*)::int AS count FROM highlight');
    expect(count).toBe(2);
  });

  it('keeps the highlights and skills when PATCH does not mention them', async () => {
    const exp = (await create(kx())).body as Experience;
    const res = await http.patch(`/api/experiences/${exp.id}`, {
      role: 'Senior Engineer',
      endDate: null,
    });
    expect(res.body).toMatchObject({ role: 'Senior Engineer', endDate: null });
    expect(res.body.highlights).toHaveLength(2);
    expect(res.body.skillIds).toHaveLength(2);
  });

  it('refuses a highlight id that belongs to another experience (400)', async () => {
    const a = (await create(kx())).body as Experience;
    const b = (await create({ company: 'Whoz', role: 'Engineer', startDate: '2026-05-01' }))
      .body as Experience;
    const stolen = a.highlights[0];
    const res = await http.patch(`/api/experiences/${b.id}`, {
      highlights: [{ id: stolen.id, date: stolen.date, level: stolen.level, message: 'mine now' }],
    });
    expect(res.status).toBe(400);
  });

  it('refuses an end date before the start date after a partial update (400)', async () => {
    const exp = (await create(kx())).body as Experience;
    expect((await http.patch(`/api/experiences/${exp.id}`, { endDate: '2020-01-01' })).status).toBe(
      400,
    );
  });

  it('deletes an experience with its highlights (204)', async () => {
    const exp = (await create(kx())).body as Experience;
    expect((await http.delete(`/api/experiences/${exp.id}`)).status).toBe(204);
    const [{ count }] = await t.dataSource.query('SELECT count(*)::int AS count FROM highlight');
    expect(count).toBe(0);
    expect((await http.patch(`/api/experiences/${exp.id}`, { role: 'x' })).status).toBe(404);
  });

  it('drops a deleted skill from experiences', async () => {
    const exp = (await create(kx())).body as Experience;
    await http.delete(`/api/skills/${ngrx.id}`);
    const [after] = (await http.get('/api/experiences')).body as Experience[];
    expect(after.id).toBe(exp.id);
    expect(after.skillIds).toEqual([angular.id]);
  });

  describe('highlight labels and skills', () => {
    const highlight = (extra: object) => ({
      highlights: [{ date: '2025-01-01', level: 'achievement', message: 'Cut latency', ...extra }],
    });

    it('defaults to no labels and no skills', async () => {
      const exp = (await create(kx())).body as Experience;
      expect(exp.highlights[0]).toMatchObject({ labels: {}, skillIds: [] });
    });

    it('saves labels and skills, listing skills in skills-list order', async () => {
      const exp = (
        await create({
          ...kx(),
          ...highlight({
            labels: { team: 'checkout', ticket_2: 'PERF-12' },
            skillIds: [ngrx.id, angular.id],
          }),
        })
      ).body as Experience;
      expect(exp.highlights[0]).toMatchObject({
        labels: { team: 'checkout', ticket_2: 'PERF-12' },
        skillIds: [angular.id, ngrx.id],
      });
      const [listed] = (await http.get('/api/experiences')).body as Experience[];
      expect(listed.highlights[0].skillIds).toEqual([angular.id, ngrx.id]);
    });

    it('replaces labels and skills on PATCH', async () => {
      const exp = (
        await create({ ...kx(), ...highlight({ labels: { team: 'a' }, skillIds: [ngrx.id] }) })
      ).body as Experience;
      const [h] = exp.highlights;
      const res = await http.patch(`/api/experiences/${exp.id}`, {
        highlights: [
          { id: h.id, date: h.date, level: h.level, message: h.message, skillIds: [angular.id] },
        ],
      });
      expect(res.body.highlights[0]).toMatchObject({
        id: h.id,
        labels: {},
        skillIds: [angular.id],
      });
    });

    it('drops a deleted skill from highlights', async () => {
      await create({ ...kx(), ...highlight({ skillIds: [angular.id, ngrx.id] }) });
      await http.delete(`/api/skills/${ngrx.id}`);
      const [after] = (await http.get('/api/experiences')).body as Experience[];
      expect(after.highlights[0].skillIds).toEqual([angular.id]);
    });

    it.each([
      ['an unknown skill id', { skillIds: [MISSING_ID] }],
      ['a skill id that is not a uuid', { skillIds: ['angular'] }],
      ['a label key with capitals', { labels: { Team: 'x' } }],
      ['a label key starting with a digit', { labels: { '2team': 'x' } }],
      ['a label key over 30 characters', { labels: { ['k'.repeat(31)]: 'x' } }],
      ['an empty label value', { labels: { team: '' } }],
      ['a label value over 60 characters', { labels: { team: 'x'.repeat(61) } }],
      ['a label value that is not a string', { labels: { team: 3 } }],
      ['labels that are not an object', { labels: ['team'] }],
      [
        'more than 10 labels',
        { labels: Object.fromEntries([...Array(11)].map((_, i) => [`k${i}`, 'v'])) },
      ],
      ['a reserved label key', { labels: { company: 'Fake' } }],
      ['the reserved key tech', { labels: { tech: 'Angular' } }],
    ])('returns 400 for %s', async (_case, extra) => {
      expect((await create({ ...kx(), ...highlight(extra) })).status).toBe(400);
    });
  });

  it('reorders experiences (204) and validates the id list (400)', async () => {
    const a = (await create(kx())).body as Experience;
    const b = (await create({ company: 'Whoz', role: 'Engineer', startDate: '2026-05-01' }))
      .body as Experience;
    expect((await http.put('/api/experiences/order', { ids: [b.id, a.id] })).status).toBe(204);
    expect(
      ((await http.get('/api/experiences')).body as Experience[]).map((e) => e.company),
    ).toEqual(['Whoz', 'KX']);
    expect((await http.put('/api/experiences/order', { ids: [a.id] })).status).toBe(400);
  });

  it('requires the admin token for every write (401)', async () => {
    const exp = (await create(kx())).body as Experience;
    expect((await http.post('/api/experiences', kx(), false)).status).toBe(401);
    expect((await http.patch(`/api/experiences/${exp.id}`, { role: 'x' }, false)).status).toBe(401);
    expect((await http.delete(`/api/experiences/${exp.id}`, false)).status).toBe(401);
    expect((await http.put('/api/experiences/order', { ids: [exp.id] }, false)).status).toBe(401);
  });
});
