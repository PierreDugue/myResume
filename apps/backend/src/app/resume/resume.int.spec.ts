import type { ResumeResponse } from '@my-resume/api-models';
import { Api, api, createTestApp, MISSING_ID, TestApp } from '../../testing/test-app';

describe('GET /api/resume', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
  });
  afterAll(() => t?.close());

  describe('on a fresh database (seed migration)', () => {
    it('contains the seeded resume of Pierre Dugue, without his phone number', async () => {
      const res = await http.get('/api/resume');
      expect(res.status).toBe(200);
      const resume = res.body as ResumeResponse;

      expect(resume.profile).toMatchObject({
        fullName: 'Pierre Dugue',
        headline: 'Senior Front-End Engineer | Angular Specialist',
        location: 'Nice, France',
        phone: null,
      });
      expect(resume.experiences.map((e) => e.company)).toEqual([
        'Whoz',
        'KX',
        'Winning Group',
        'Isentia',
        'Fairfax Media',
        'R3D',
        'LXA Conseil',
        'Capgemini',
      ]);
      expect(resume.education.map((e) => e.school)).toEqual(['ESIL', 'IUT R&T']);
      expect(resume.skills.length).toBeGreaterThanOrEqual(40);
      expect(resume.projects.map((p) => p.slug)).toEqual(['pierre-o11y']);

      const kx = resume.experiences.find((e) => e.company === 'KX');
      expect(kx?.highlights.length).toBeGreaterThanOrEqual(5);
      expect(kx?.highlights.find((h) => h.impact?.changePct === -35)).toBeDefined();
      const angular = resume.skills.find((s) => s.name === 'Angular');
      expect(kx?.skillIds).toContain(angular?.id);
    });

    it('does not seed again on a database that already has content', async () => {
      const { MIGRATIONS } = await import('../database/migrations');
      expect(MIGRATIONS.length).toBeGreaterThan(0);
      const before = await t.dataSource.query('SELECT count(*)::int AS count FROM experience');
      await t.dataSource.undoLastMigration();
      await t.dataSource.runMigrations();
      const after = await t.dataSource.query('SELECT count(*)::int AS count FROM experience');
      expect(after).toEqual(before);
    });
  });

  describe('with custom content', () => {
    beforeEach(() => t.truncateContent());

    it('is public and returns every list, sorted', async () => {
      const skill = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
      await http.post('/api/experiences', {
        company: 'B',
        role: 'r',
        startDate: '2020-01-01',
        skillIds: [skill.id],
      });
      await http.post('/api/experiences', { company: 'A', role: 'r', startDate: '2021-01-01' });
      await http.post('/api/education', { school: 'ESIL', degree: 'd', startDate: '2008-09-01' });
      await http.post('/api/projects', { title: 'Site', description: 'd' });

      const resume = (await http.get('/api/resume')).body as ResumeResponse;
      expect(resume.profile).toBeNull();
      expect(resume.experiences.map((e) => e.company)).toEqual(['B', 'A']);
      expect(resume.experiences[0].skillIds).toEqual([skill.id]);
      expect(resume.education).toHaveLength(1);
      expect(resume.skills).toHaveLength(1);
      expect(resume.projects).toHaveLength(1);
    });
  });

  describe('caching (docs/api-contract.md, Content: caching delay)', () => {
    beforeEach(() => t.truncateContent());

    const resume = async () => (await http.get('/api/resume')).body as ResumeResponse;
    const renameSkillInDatabase = (id: string, name: string) =>
      t.dataSource.query('UPDATE "skill" SET "name" = $1 WHERE "id" = $2', [name, id]);

    it('serves the cached resume: an edit made directly in the database does not show yet', async () => {
      const skill = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
      expect((await resume()).skills.map((s) => s.name)).toEqual(['Angular']);

      await renameSkillInDatabase(skill.id, 'Renamed in SQL');

      expect((await resume()).skills.map((s) => s.name)).toEqual(['Angular']);
    });

    it('is cleared by a failed write too', async () => {
      const skill = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
      await resume();
      await renameSkillInDatabase(skill.id, 'Renamed in SQL');

      expect((await http.patch(`/api/skills/${MISSING_ID}`, { name: 'x' })).status).toBe(404);

      expect((await resume()).skills.map((s) => s.name)).toEqual(['Renamed in SQL']);
    });

    it('is not cleared by a read of another endpoint', async () => {
      const skill = (await http.post('/api/skills', { name: 'Angular', category: 'Core' })).body;
      await resume();
      await renameSkillInDatabase(skill.id, 'Renamed in SQL');

      expect((await http.get('/api/skills')).body[0].name).toBe('Renamed in SQL');
      expect((await resume()).skills.map((s) => s.name)).toEqual(['Angular']);
    });

    it('shows a profile replaced with PUT on the next read', async () => {
      const profile = {
        fullName: 'Pierre Dugue',
        headline: 'Before',
        summary: 's',
        email: 'pierre@example.com',
        phone: null,
        showPhone: false,
        location: 'Nice, France',
        openToRelocation: false,
        avatarUrl: null,
        links: [],
        interests: null,
        yearsInIt: null,
        yearsOfAngular: null,
      };
      expect((await http.put('/api/profile', profile)).status).toBe(200);
      expect((await resume()).profile?.headline).toBe('Before');

      expect((await http.put('/api/profile', { ...profile, headline: 'After' })).status).toBe(200);

      expect((await resume()).profile?.headline).toBe('After');
    });

    type ListKey = 'skills' | 'experiences' | 'education' | 'projects';
    const resources: {
      path: string;
      key: ListKey;
      label: (item: Record<string, unknown>) => unknown;
      create: (n: string) => object;
      patch: (n: string) => object;
    }[] = [
      {
        path: '/api/skills',
        key: 'skills',
        label: (i) => i['name'],
        create: (n) => ({ name: n, category: 'Core' }),
        patch: (n) => ({ name: n }),
      },
      {
        path: '/api/experiences',
        key: 'experiences',
        label: (i) => i['company'],
        create: (n) => ({ company: n, role: 'r', startDate: '2020-01-01' }),
        patch: (n) => ({ company: n }),
      },
      {
        path: '/api/education',
        key: 'education',
        label: (i) => i['school'],
        create: (n) => ({ school: n, degree: 'd', startDate: '2010-01-01' }),
        patch: (n) => ({ school: n }),
      },
      {
        path: '/api/projects',
        key: 'projects',
        label: (i) => i['title'],
        create: (n) => ({ title: n, description: 'd' }),
        patch: (n) => ({ title: n }),
      },
    ];

    describe.each(resources)('$path', ({ path, key, label, create, patch }) => {
      const labels = async () =>
        ((await resume())[key] as unknown as Record<string, unknown>[]).map(label);

      it('shows every write on the next read: POST, PATCH, PUT order, DELETE', async () => {
        const a = (await http.post(path, create('A'))).body;
        expect(await labels()).toEqual(['A']);

        const b = (await http.post(path, create('B'))).body;
        expect(await labels()).toEqual(['A', 'B']);

        expect((await http.patch(`${path}/${a.id}`, patch('A2'))).status).toBe(200);
        expect(await labels()).toEqual(['A2', 'B']);

        expect((await http.put(`${path}/order`, { ids: [b.id, a.id] })).status).toBe(204);
        expect(await labels()).toEqual(['B', 'A2']);

        expect((await http.delete(`${path}/${b.id}`)).status).toBe(204);
        expect(await labels()).toEqual(['A2']);
      });
    });
  });
});
