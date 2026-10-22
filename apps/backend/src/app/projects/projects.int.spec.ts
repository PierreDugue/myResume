import type { Project, Skill } from '@my-resume/api-models';
import { Api, api, createTestApp, MISSING_ID, TestApp } from '../../testing/test-app';

describe('Projects API', () => {
  let t: TestApp;
  let http: Api;
  let angular: Skill;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  beforeEach(async () => {
    await t.truncateContent();
    angular = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
  });

  const site = () => ({
    title: 'Pierre O11y — this site',
    description: 'My resume as an observability platform.',
    url: 'https://example.com',
    repoUrl: 'https://github.com/example/my-resume',
    startDate: '2026-10-21',
    skillIds: [angular.id],
  });
  const create = (body: object) => http.post('/api/projects', body);

  it('creates a project (201), generating the slug from the title', async () => {
    const res = await create(site());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slug: 'pierre-o11y-this-site',
      endDate: null,
      imageUrl: null,
      skillIds: [angular.id],
      sortOrder: 0,
    });
  });

  it('lists the skills of a project in the order of the skills list', async () => {
    const jest = (await http.post('/api/skills', { name: 'Jest', category: 'Testing' })).body;
    const project = (await create({ ...site(), skillIds: [jest.id, angular.id] })).body as Project;
    expect(project.skillIds).toEqual([angular.id, jest.id]);
  });

  it('returns 409 for a duplicate slug', async () => {
    await create(site());
    expect(
      (await create({ ...site(), title: 'Other', slug: 'pierre-o11y-this-site' })).status,
    ).toBe(409);
  });

  it.each([
    ['a URL that is not http(s)', { url: 'ftp://example.com' }],
    ['a value that is not a URL', { repoUrl: 'not a url' }],
    ['an unknown skill id', { skillIds: [MISSING_ID] }],
    ['an end date before the start date', { endDate: '2020-01-01' }],
    ['a missing description', { description: undefined }],
  ])('returns 400 for %s', async (_case, override) => {
    expect((await create({ ...site(), ...override })).status).toBe(400);
  });

  it('updates, lists, reorders and deletes', async () => {
    const a = (await create(site())).body as Project;
    const b = (await create({ ...site(), title: 'Second project' })).body as Project;

    const patched = await http.patch(`/api/projects/${a.id}`, { url: null, skillIds: [] });
    expect(patched.body).toMatchObject({ url: null, skillIds: [] });

    expect((await http.put('/api/projects/order', { ids: [b.id, a.id] })).status).toBe(204);
    expect(((await http.get('/api/projects')).body as Project[]).map((p) => p.slug)).toEqual([
      'second-project',
      'pierre-o11y-this-site',
    ]);

    expect((await http.delete(`/api/projects/${b.id}`)).status).toBe(204);
    expect((await http.get('/api/projects')).body).toHaveLength(1);
  });

  it('requires the admin token for writes (401)', async () => {
    expect((await http.post('/api/projects', site(), false)).status).toBe(401);
  });
});
