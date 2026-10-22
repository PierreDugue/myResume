import type { Education } from '@my-resume/api-models';
import { Api, api, createTestApp, MISSING_ID, TestApp, UUID } from '../../testing/test-app';

describe('Education API', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  beforeEach(() => t.truncateContent());

  const esil = {
    school: 'ESIL',
    degree: "Diplôme d'ingénieur",
    field: 'Computer Science, Network & Multimedia',
    location: 'Marseille, France',
    startDate: '2008-09-01',
    endDate: '2011-06-30',
  };
  const create = (body: object) => http.post('/api/education', body);

  it('creates an entry (201) at the end of the list', async () => {
    const res = await create(esil);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ...esil,
      id: expect.stringMatching(UUID),
      description: null,
      sortOrder: 0,
    });
    expect((await create({ ...esil, school: 'IUT R&T' })).body.sortOrder).toBe(1);
  });

  it('lists entries publicly', async () => {
    await create(esil);
    const res = await http.get('/api/education');
    expect(res.status).toBe(200);
    expect((res.body as Education[]).map((e) => e.school)).toEqual(['ESIL']);
  });

  it('updates only the fields sent (PATCH)', async () => {
    const { body } = await create(esil);
    const res = await http.patch(`/api/education/${body.id}`, {
      description: 'Engineering degree',
      field: null,
    });
    expect(res.body).toMatchObject({
      school: 'ESIL',
      description: 'Engineering degree',
      field: null,
    });
  });

  it.each([
    ['a missing school', { school: undefined }],
    ['a missing start date', { startDate: undefined }],
    ['an end date before the start date', { endDate: '2007-01-01' }],
    ['an unknown field', { gpa: 4 }],
  ])('returns 400 for %s', async (_case, override) => {
    expect((await create({ ...esil, ...override })).status).toBe(400);
  });

  it('deletes (204), returns 404 for unknown ids, and reorders (204)', async () => {
    const a = (await create(esil)).body as Education;
    const b = (await create({ ...esil, school: 'IUT R&T' })).body as Education;
    expect((await http.put('/api/education/order', { ids: [b.id, a.id] })).status).toBe(204);
    expect(((await http.get('/api/education')).body as Education[])[0].school).toBe('IUT R&T');
    expect((await http.delete(`/api/education/${a.id}`)).status).toBe(204);
    expect((await http.delete(`/api/education/${MISSING_ID}`)).status).toBe(404);
  });

  it('requires the admin token for writes (401)', async () => {
    expect((await create({ ...esil })).status).toBe(201);
    expect((await http.post('/api/education', esil, false)).status).toBe(401);
  });
});
