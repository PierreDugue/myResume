import { resumeFixture, TODAY } from './fixtures';
import { buildServiceMap } from './service-map';

describe('buildServiceMap', () => {
  const map = () => buildServiceMap(resumeFixture(), TODAY);

  it('lists jobs, dated projects and the skills they use, with their experience in years', () => {
    expect(map().nodes).toEqual([
      // May → Oct 2026: 6 months.
      { id: 'job:e-whoz', kind: 'job', label: 'Whoz', years: 0.5, slug: null, category: null },
      // Sep 2022 → Nov 2025: 39 months.
      { id: 'job:e-kx', kind: 'job', label: 'KX', years: 3.3, slug: null, category: null },
      {
        id: 'job:e-capgemini',
        kind: 'job',
        label: 'Capgemini',
        years: 1.9,
        slug: null,
        category: null,
      },
      // Oct 2026: 1 month. The undated project is left out.
      {
        id: 'project:p-site',
        kind: 'project',
        label: 'This site',
        years: 0.1,
        slug: 'site',
        category: null,
      },
      // Whoz 6 + KX 39 months (the site overlaps Whoz): 45 months.
      {
        id: 'skill:sk-angular',
        kind: 'skill',
        label: 'Angular',
        years: 3.8,
        slug: 'angular',
        category: 'Core',
      },
      {
        id: 'skill:sk-ngrx',
        kind: 'skill',
        label: 'NgRx',
        years: 3.3,
        slug: 'ngrx',
        category: 'State',
      },
      {
        id: 'skill:sk-java',
        kind: 'skill',
        label: 'Java',
        years: 1.9,
        slug: 'java',
        category: 'Languages',
      },
      {
        id: 'skill:sk-claude',
        kind: 'skill',
        label: 'Claude',
        years: 0.5,
        slug: 'claude',
        category: 'AI',
      },
      // React is only used by the undated project: no node.
    ]);
  });

  it('links each job and project to its skills, a project through its spans too', () => {
    expect(map().edges).toEqual([
      { source: 'job:e-whoz', target: 'skill:sk-angular' },
      { source: 'job:e-whoz', target: 'skill:sk-claude' },
      { source: 'job:e-kx', target: 'skill:sk-angular' },
      { source: 'job:e-kx', target: 'skill:sk-ngrx' },
      { source: 'job:e-capgemini', target: 'skill:sk-java' },
      { source: 'project:p-site', target: 'skill:sk-angular' },
      { source: 'project:p-site', target: 'skill:sk-ngrx' },
      { source: 'project:p-site', target: 'skill:sk-claude' },
    ]);
  });

  it('is empty for an empty resume', () => {
    const resume = { ...resumeFixture(), experiences: [], projects: [] };
    expect(buildServiceMap(resume, TODAY)).toEqual({ nodes: [], edges: [] });
  });
});
