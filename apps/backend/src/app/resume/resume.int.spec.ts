import type { ResumeResponse } from '@my-resume/api-models';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

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
});
