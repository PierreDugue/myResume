import type { Profile, ResumeResponse } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('Profile API', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());
  beforeEach(() => t.truncateContent());

  const profile = (): Profile => ({
    fullName: 'Pierre Dugue',
    headline: 'Senior Front-End Engineer | Angular Specialist',
    summary: 'Senior Angular developer.',
    email: 'pierre@example.com',
    phone: '+33 6 00 00 00 00',
    showPhone: false,
    location: 'Nice, France',
    openToRelocation: true,
    avatarUrl: null,
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' }],
    interests: 'Guitar, photography',
    yearsInIt: 14,
    yearsOfAngular: 9,
  });

  it('is only readable by the admin (401 when signed out)', async () => {
    expect((await http.get('/api/profile')).status).toBe(401);
  });

  it('returns 404 while no profile exists, then PUT creates it (200)', async () => {
    expect((await http.get('/api/profile', true)).status).toBe(404);
    const put = await http.put('/api/profile', profile());
    expect(put.status).toBe(200);
    expect(put.body).toEqual(profile());
    expect((await http.get('/api/profile', true)).body).toEqual(profile());
  });

  it('replaces the whole profile on PUT', async () => {
    await http.put('/api/profile', profile());
    const res = await http.put('/api/profile', {
      ...profile(),
      phone: null,
      links: [],
      yearsInIt: null,
    });
    expect(res.body).toMatchObject({
      phone: null,
      links: [],
      yearsInIt: null,
      fullName: 'Pierre Dugue',
    });
  });

  it.each([
    ['an invalid email', { email: 'nope' }],
    ['a link without a valid URL', { links: [{ label: 'Site', url: 'javascript:alert(1)' }] }],
    [
      'more than 10 links',
      { links: Array.from({ length: 11 }, () => ({ label: 'x', url: 'https://x.dev' })) },
    ],
    ['negative years', { yearsInIt: -1 }],
    ['a missing headline', { headline: undefined }],
    ['an unknown field', { age: 40 }],
  ])('returns 400 for %s', async (_case, override) => {
    expect((await http.put('/api/profile', { ...profile(), ...override })).status).toBe(400);
  });

  it('requires the admin token to write (401)', async () => {
    expect((await http.put('/api/profile', profile(), false)).status).toBe(401);
  });

  it('hides the phone on the public resume unless showPhone is true', async () => {
    await http.put('/api/profile', profile());
    let resume = (await http.get('/api/resume')).body as ResumeResponse;
    expect(resume.profile?.phone).toBeNull();
    expect(resume.profile).not.toHaveProperty('showPhone');

    await http.put('/api/profile', { ...profile(), showPhone: true });
    resume = (await http.get('/api/resume')).body as ResumeResponse;
    expect(resume.profile?.phone).toBe('+33 6 00 00 00 00');
  });
});
