import type { Project, ProjectSpan, Skill } from '@my-resume/api-models';
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

  it.each([['slug'], ['title'], ['description']])(
    'returns 400 when a PATCH sets the non-nullable %s to null',
    async (key) => {
      const project = (await create(site())).body as Project;
      expect((await http.patch(`/api/projects/${project.id}`, { [key]: null })).status).toBe(400);
    },
  );

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

  describe('spans', () => {
    /** An outline: Design, Build > (API, UI). */
    const outline = () => [
      {
        depth: 0,
        name: 'Design',
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        note: 'The spec.',
      },
      { depth: 0, name: 'Build', startDate: '2026-10-22', endDate: null, skillIds: [angular.id] },
      { depth: 1, name: 'API', startDate: '2026-10-22', endDate: '2026-10-22' },
      { depth: 1, name: 'UI', startDate: '2026-10-23', endDate: null },
    ];
    const withSpans = async (spans: object[] = outline()) =>
      (await create({ ...site(), spans })).body as Project;
    const shape = (spans: ProjectSpan[]) =>
      spans.map((s) => [s.name, s.depth, spans.find((p) => p.id === s.parentId)?.name ?? null]);

    it('defaults to no spans', async () => {
      expect((await create(site())).body.spans).toEqual([]);
    });

    it('saves an outline, with parents worked out from the depths', async () => {
      const project = await withSpans();
      expect(shape(project.spans)).toEqual([
        ['Design', 0, null],
        ['Build', 0, null],
        ['API', 1, 'Build'],
        ['UI', 1, 'Build'],
      ]);
      expect(project.spans[0]).toMatchObject({
        endDate: '2026-10-21',
        note: 'The spec.',
        skillIds: [],
        sortOrder: 0,
      });
      expect(project.spans[1]).toMatchObject({ endDate: null, note: null, skillIds: [angular.id] });
      const [listed] = (await http.get('/api/projects')).body as Project[];
      expect(shape(listed.spans)).toEqual(shape(project.spans));
      const resume = (await http.get('/api/resume')).body;
      expect(resume.projects[0].spans).toHaveLength(4);
    });

    it('replaces the outline on PATCH: keeps ids it is given, moves spans, deletes the rest', async () => {
      const project = await withSpans();
      const [design, build, apiSpan] = project.spans;
      const res = await http.patch(`/api/projects/${project.id}`, {
        spans: [
          { id: build.id, depth: 0, name: 'Build', startDate: build.startDate, endDate: null },
          { id: design.id, depth: 1, name: 'Design again', startDate: '2026-10-22', endDate: null },
          { depth: 2, name: 'New', startDate: '2026-10-22', endDate: '2026-10-22' },
          { id: apiSpan.id, depth: 0, name: 'API', startDate: '2026-10-22', endDate: '2026-10-22' },
        ],
      });
      expect(res.status).toBe(200);
      const spans = (res.body as Project).spans;
      expect(shape(spans)).toEqual([
        ['Build', 0, null],
        ['Design again', 1, 'Build'],
        ['New', 2, 'Design again'],
        ['API', 0, null],
      ]);
      expect(spans.map((s) => s.id).slice(0, 2)).toEqual([build.id, design.id]);
      expect(spans[3].id).toBe(apiSpan.id);
      const [{ count }] = await t.dataSource.query(
        'SELECT count(*)::int AS count FROM project_span',
      );
      expect(count).toBe(4);
    });

    it('keeps the spans when PATCH does not mention them', async () => {
      const project = await withSpans();
      const res = await http.patch(`/api/projects/${project.id}`, { title: 'Renamed' });
      expect(res.body.spans).toHaveLength(4);
    });

    it.each([
      [
        'a first span below the top level',
        [{ depth: 1, name: 'A', startDate: '2026-10-21' }],
        'must be at the top level',
      ],
      [
        'a span two levels deeper than the one above',
        [
          { depth: 0, name: 'A', startDate: '2026-10-21' },
          { depth: 2, name: 'B', startDate: '2026-10-21' },
        ],
        'one level deeper',
      ],
      [
        'a span ending after its parent',
        [
          { depth: 0, name: 'A', startDate: '2026-10-21', endDate: '2026-10-22' },
          { depth: 1, name: 'B', startDate: '2026-10-21', endDate: null },
        ],
        'can\'t end after "A"',
      ],
      [
        'a span starting before the project',
        [{ depth: 0, name: 'A', startDate: '2026-10-20' }],
        'before the project',
      ],
      [
        'a span ending before it starts',
        [{ depth: 0, name: 'A', startDate: '2026-10-22', endDate: '2026-10-21' }],
        '',
      ],
    ])('returns 400 for %s', async (_case, spans, message) => {
      const res = await create({ ...site(), spans });
      expect(res.status).toBe(400);
      expect([res.body.message].flat().join(' ')).toContain(message);
    });

    it.each([
      ['an unknown skill', { skillIds: [MISSING_ID] }],
      ['a missing name', { name: undefined }],
      ['a name over 120 characters', { name: 'x'.repeat(121) }],
      ['a depth over 3', { depth: 4 }],
      ['a depth that is not an integer', { depth: 0.5 }],
      ['an invalid date', { startDate: '2026-13-01' }],
    ])('returns 400 for a span with %s', async (_case, override) => {
      const spans = [{ depth: 0, name: 'A', startDate: '2026-10-21', ...override }];
      expect((await create({ ...site(), spans })).status).toBe(400);
    });

    it('refuses a span id that belongs to another project (400)', async () => {
      const a = await withSpans();
      const b = (await create({ ...site(), slug: 'other' })).body as Project;
      const stolen = a.spans[0];
      const res = await http.patch(`/api/projects/${b.id}`, {
        spans: [{ id: stolen.id, depth: 0, name: 'Mine', startDate: '2026-10-21' }],
      });
      expect(res.status).toBe(400);
    });

    it('checks the existing spans again when the project dates change', async () => {
      const project = await withSpans();
      const res = await http.patch(`/api/projects/${project.id}`, { startDate: '2026-10-22' });
      expect(res.status).toBe(400);
      expect([res.body.message].flat().join(' ')).toContain(
        'Span 1 "Design" can\'t start before the project',
      );
    });

    it('drops a deleted skill from spans, and deletes spans with their project', async () => {
      const project = await withSpans();
      await http.delete(`/api/skills/${angular.id}`);
      const [listed] = (await http.get('/api/projects')).body as Project[];
      expect(listed.spans[1].skillIds).toEqual([]);

      await http.delete(`/api/projects/${project.id}`);
      const [{ count }] = await t.dataSource.query(
        'SELECT count(*)::int AS count FROM project_span',
      );
      expect(count).toBe(0);
    });
  });

  it('requires the admin token for writes (401)', async () => {
    expect((await http.post('/api/projects', site(), false)).status).toBe(401);
  });
});
