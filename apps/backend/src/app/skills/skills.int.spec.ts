import type { Skill } from '@my-resume/api-models';
import { Api, api, createTestApp, MISSING_ID, TestApp, UUID } from '../../testing/test-app';

describe('Skills API', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  beforeEach(() => t.truncateContent());

  const create = (body: object) => http.post('/api/skills', body);

  it('creates a skill (201), generating the slug and adding it at the end of the list', async () => {
    const first = await create({ name: 'Angular', category: 'Core Frameworks', level: 5 });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      id: expect.stringMatching(UUID),
      name: 'Angular',
      slug: 'angular',
      category: 'Core Frameworks',
      level: 5,
      sortOrder: 0,
    });

    const second = await create({ name: 'CSS3/SASS', category: 'Languages' });
    expect(second.body).toMatchObject({ slug: 'css3-sass', level: null, sortOrder: 1 });
  });

  it('lists skills publicly, sorted by sortOrder', async () => {
    await create({ name: 'Angular', category: 'Core Frameworks' });
    await create({ name: 'RxJS', category: 'State & Reactive' });

    const res = await http.get('/api/skills');
    expect(res.status).toBe(200);
    expect((res.body as Skill[]).map((s) => s.name)).toEqual(['Angular', 'RxJS']);
  });

  it('updates only the fields sent; null clears the level', async () => {
    const { body: skill } = await create({ name: 'NgRx', category: 'State', level: 4 });

    const renamed = await http.patch(`/api/skills/${skill.id}`, { category: 'State & Reactive' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'NgRx', category: 'State & Reactive', level: 4 });

    const cleared = await http.patch(`/api/skills/${skill.id}`, { level: null });
    expect(cleared.body.level).toBeNull();
  });

  it('returns 409 for a duplicate name (any case) or slug', async () => {
    await create({ name: 'Angular', category: 'Core Frameworks' });
    expect((await create({ name: 'ANGULAR', category: 'x' })).status).toBe(409);
    expect((await create({ name: 'Angular 2', slug: 'angular', category: 'x' })).status).toBe(409);

    const { body: other } = await create({ name: 'React', category: 'Core Frameworks' });
    expect((await http.patch(`/api/skills/${other.id}`, { name: 'angular' })).status).toBe(409);
  });

  it.each([
    ['a missing name', { category: 'x' }],
    ['a missing category', { name: 'Vue' }],
    ['level 0', { name: 'Vue', category: 'x', level: 0 }],
    ['level 6', { name: 'Vue', category: 'x', level: 6 }],
    ['a non-integer level', { name: 'Vue', category: 'x', level: 2.5 }],
    ['an invalid slug', { name: 'Vue', category: 'x', slug: 'Not A Slug' }],
    ['a name over 120 characters', { name: 'x'.repeat(121), category: 'x' }],
    ['an unknown field', { name: 'Vue', category: 'x', color: 'red' }],
  ])('returns 400 for %s', async (_case, body) => {
    expect((await create(body)).status).toBe(400);
  });

  it('returns 404 for an unknown id and 400 for an id that is not a uuid', async () => {
    expect((await http.patch(`/api/skills/${MISSING_ID}`, { level: 1 })).status).toBe(404);
    expect((await http.delete(`/api/skills/${MISSING_ID}`)).status).toBe(404);
    expect((await http.patch('/api/skills/not-a-uuid', { level: 1 })).status).toBe(400);
  });

  it('deletes a skill (204)', async () => {
    const { body: skill } = await create({ name: 'Webpack', category: 'Tools' });
    expect((await http.delete(`/api/skills/${skill.id}`)).status).toBe(204);
    expect((await http.get('/api/skills')).body).toEqual([]);
  });

  it('reorders the list (204) when every id is given exactly once', async () => {
    const a = (await create({ name: 'A', category: 'x' })).body as Skill;
    const b = (await create({ name: 'B', category: 'x' })).body as Skill;
    const c = (await create({ name: 'C', category: 'x' })).body as Skill;

    expect((await http.put('/api/skills/order', { ids: [c.id, a.id, b.id] })).status).toBe(204);
    const list = (await http.get('/api/skills')).body as Skill[];
    expect(list.map((s) => s.name)).toEqual(['C', 'A', 'B']);
    expect(list.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it('rejects a reorder that misses, repeats or invents ids (400)', async () => {
    const a = (await create({ name: 'A', category: 'x' })).body as Skill;
    const b = (await create({ name: 'B', category: 'x' })).body as Skill;
    for (const ids of [[a.id], [a.id, a.id], [a.id, b.id, MISSING_ID]]) {
      expect((await http.put('/api/skills/order', { ids })).status).toBe(400);
    }
  });

  it('requires the admin token for every write (401)', async () => {
    const { body: skill } = await create({ name: 'Jest', category: 'Testing' });
    expect((await http.post('/api/skills', { name: 'X', category: 'x' }, false)).status).toBe(401);
    expect((await http.patch(`/api/skills/${skill.id}`, { level: 1 }, false)).status).toBe(401);
    expect((await http.delete(`/api/skills/${skill.id}`, false)).status).toBe(401);
    expect((await http.put('/api/skills/order', { ids: [skill.id] }, false)).status).toBe(401);
  });
});
