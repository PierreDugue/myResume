import type { LogsQuery } from '@my-resume/api-models';
import { QueryParseError } from '@my-resume/query-parser';
import { DashboardQueryError } from './dashboard';
import { resumeFixture, TODAY } from './fixtures';
import { buildLogs, logLabels } from './logs';

const build = (query: LogsQuery = {}, resume = resumeFixture()) =>
  buildLogs({ resume, today: TODAY, query });
const ids = (query: LogsQuery) => build(query).entries.map((e) => e.id);

describe('buildLogs', () => {
  it('turns highlights, education and dated projects into log lines, newest first', () => {
    const logs = build();
    expect(logs.entries.map((e) => [e.date, e.level, e.source, e.message])).toEqual([
      ['2026-10-22', 'achievement', 'Whoz', 'Generate 95% of code with Claude.'],
      ['2026-10-21', 'milestone', 'This site', 'This site: d'],
      ['2025-11-30', 'achievement', 'KX', 'Cut page load time by 35%.'],
      ['2025-11-30', 'milestone', 'KX', 'Introduced NX.'],
      ['2011-06-30', 'milestone', 'ESIL', 'Graduated: Engineering degree'],
    ]);
    expect(logs.total).toBe(5);
    expect(logs.query).toBe('');
  });

  it('labels a highlight with its job, its own labels and its technologies', () => {
    const kx = build().entries.find((e) => e.id === 'h-kx-1');
    expect(kx).toEqual({
      id: 'h-kx-1',
      type: 'experience',
      date: '2025-11-30',
      level: 'achievement',
      source: 'KX',
      message: 'Cut page load time by 35%.',
      labels: {
        type: 'experience',
        level: 'achievement',
        company: 'KX',
        role: 'Front-End Engineer',
        location: 'Full Remote',
        team: 'platform',
      },
      // In skills-list order.
      tech: ['Angular', 'NgRx'],
    });
    // No location label when the job has none.
    expect(build().entries.find((e) => e.id === 'h-whoz')?.labels).toEqual({
      type: 'experience',
      level: 'achievement',
      company: 'Whoz',
      role: 'Engineer',
    });
  });

  it('ignores own labels that would hide a generated one', () => {
    const resume = resumeFixture();
    resume.experiences[1].highlights[0].labels = { company: 'Fake', team: 'platform' };
    expect(build({}, resume).entries.find((e) => e.id === 'h-kx-1')?.labels['company']).toBe('KX');
  });

  it('dates education at its end, or its start while ongoing', () => {
    const resume = resumeFixture();
    const esil = build().entries.find((e) => e.id === 'ed-esil');
    expect(esil).toMatchObject({
      type: 'education',
      labels: {
        type: 'education',
        level: 'milestone',
        school: 'ESIL',
        degree: 'Engineering degree',
      },
      tech: [],
    });
    Object.assign(resume.education[0], {
      endDate: null,
      field: 'Computer Science',
      location: 'Lyon',
    });
    expect(build({}, resume).entries.find((e) => e.id === 'ed-esil')).toMatchObject({
      date: '2008-09-01',
      message: 'Started: Engineering degree, Computer Science',
      labels: { location: 'Lyon' },
    });
  });

  it('labels a project with its slug and technologies; undated projects are left out', () => {
    const site = build().entries.find((e) => e.id === 'p-site');
    expect(site).toMatchObject({
      type: 'project',
      labels: { type: 'project', level: 'milestone', project: 'site' },
      tech: ['Angular'],
    });
    expect(ids({})).not.toContain('p-undated');
  });

  describe('query', () => {
    it('filters with labels, technologies and text', () => {
      expect(ids({ query: '{company="kx"}' })).toEqual(['h-kx-1', 'h-kx-2']);
      expect(ids({ query: '{type="education"}' })).toEqual(['ed-esil']);
      expect(ids({ query: '{level=~"achievement|milestone", type!="experience"}' })).toEqual([
        'p-site',
        'ed-esil',
      ]);
      expect(ids({ query: '{tech="angular"}' })).toEqual(['p-site', 'h-kx-1']);
      expect(ids({ query: '{team="platform"}' })).toEqual(['h-kx-1']);
      expect(ids({ query: '|= "nx"' })).toEqual(['h-kx-2']);
    });

    it('searches the source as part of the line', () => {
      expect(ids({ query: 'whoz' })).toEqual(['h-whoz']);
      expect(ids({ query: '{type="experience"} |~ "^kx "' })).toEqual(['h-kx-1', 'h-kx-2']);
    });

    it('returns the query as received', () => {
      expect(build({ query: ' {type="project"} ' }).query).toBe(' {type="project"} ');
    });

    it('throws a QueryParseError for an invalid query', () => {
      expect(() => build({ query: '{type=' })).toThrow(QueryParseError);
    });
  });

  describe('range', () => {
    it('covers every line by default, until the current year', () => {
      expect(build().range).toEqual({ from: 2011, to: 2026 });
    });

    it('keeps the lines of the selected years', () => {
      const logs = build({ from: 2025, to: 2025 });
      expect(logs.range).toEqual({ from: 2025, to: 2025 });
      // The bounds stay the whole span, for the range picker.
      expect(logs.bounds).toEqual({ from: 2011, to: 2026 });
      expect(logs.entries.map((e) => e.id)).toEqual(['h-kx-1', 'h-kx-2']);
      expect(logs.total).toBe(2);
    });

    it('uses the current year when there is nothing to show', () => {
      const resume = { ...resumeFixture(), experiences: [], education: [], projects: [] };
      expect(build({}, resume)).toMatchObject({
        range: { from: 2026, to: 2026 },
        bounds: { from: 2026, to: 2026 },
        total: 0,
      });
    });

    it.each([[{ from: 1800 }], [{ to: 2101 }], [{ from: 2020, to: 2010 }], [{ from: 2020.5 }]])(
      'rejects %j',
      (query) => {
        expect(() => build(query)).toThrow(DashboardQueryError);
      },
    );
  });

  it('counts the matching lines per year and level, over the whole range', () => {
    const logs = build({ from: 2024, query: '{level!="info"}' });
    expect(logs.volume).toEqual([
      { year: 2024, total: 0, levels: { achievement: 0, info: 0, learning: 0, milestone: 0 } },
      { year: 2025, total: 2, levels: { achievement: 1, info: 0, learning: 0, milestone: 1 } },
      { year: 2026, total: 2, levels: { achievement: 1, info: 0, learning: 0, milestone: 1 } },
    ]);
  });
});

describe('logLabels', () => {
  it('lists the labels in use, type and level first, with their sorted values', () => {
    expect(logLabels(resumeFixture())).toEqual([
      { name: 'type', values: ['education', 'experience', 'project'] },
      { name: 'level', values: ['achievement', 'milestone'] },
      { name: 'company', values: ['KX', 'Whoz'] },
      { name: 'degree', values: ['Engineering degree'] },
      { name: 'location', values: ['Full Remote'] },
      { name: 'project', values: ['site'] },
      { name: 'role', values: ['Engineer', 'Front-End Engineer'] },
      { name: 'school', values: ['ESIL'] },
      { name: 'team', values: ['platform'] },
      { name: 'tech', values: ['Angular', 'Claude', 'NgRx'] },
    ]);
  });
});
