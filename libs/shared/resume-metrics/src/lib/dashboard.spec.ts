import type { DashboardQuery, ResumeResponse } from '@my-resume/api-models';
import { buildDashboard, DashboardQueryError } from './dashboard';
import { resumeFixture, TODAY } from './fixtures';

const build = (query = {}) => buildDashboard({ resume: resumeFixture(), today: TODAY, query });
const series = (d: ReturnType<typeof build>, name: string) =>
  d.skillUsage.series.find((s) => s.name === name);

describe('buildDashboard', () => {
  describe('range and filters', () => {
    it('defaults to the first job year until the current year', () => {
      const d = build();
      expect(d.range).toEqual({ from: 2011, to: 2026 });
      expect(d.skillUsage.years).toEqual([...Array(16)].map((_, i) => 2011 + i));
      expect(d.applied).toEqual({ category: null, skill: null });
    });

    it('lists the filter options: years with content (education included), categories, skills', () => {
      expect(build().filters).toEqual({
        minYear: 2008,
        maxYear: 2026,
        categories: ['Core', 'State', 'Languages', 'AI'],
        skills: [
          { slug: 'angular', name: 'Angular', category: 'Core' },
          { slug: 'ngrx', name: 'NgRx', category: 'State' },
          { slug: 'java', name: 'Java', category: 'Languages' },
          { slug: 'claude', name: 'Claude', category: 'AI' },
          { slug: 'react', name: 'React', category: 'Core' },
        ],
      });
    });

    it.each([
      ['from after to', { from: 2025, to: 2020 }],
      ['a year before 1950', { from: 1900 }],
      ['a year after 2100', { to: 2200 }],
      ['a non-integer year', { from: 2020.5 }],
      ['an unknown skill', { skill: 'cobol' }],
      ['an unknown category', { category: 'Gardening' }],
    ])('rejects %s', (_case, query) => {
      expect(() => build(query)).toThrow(DashboardQueryError);
    });
  });

  describe('skill usage (months of use)', () => {
    it('counts each month a skill was used, once even when jobs and projects overlap', () => {
      const angular = series(build(), 'Angular');
      // KX Sep 2022–Nov 2025 = 39 months, Whoz May–Oct 2026 = 6 (the site project overlaps Whoz).
      expect(angular?.totalYears).toBe(3.8);
      const at = (year: number) => angular?.monthsPerYear[year - 2011];
      expect([at(2021), at(2022), at(2023), at(2024), at(2025), at(2026)]).toEqual([
        0, 4, 12, 12, 11, 6,
      ]);
    });

    it('gives the all-time experience at the end of each year', () => {
      const angular = series(build({ from: 2022, to: 2026 }), 'Angular');
      expect(angular?.cumulativeYears).toEqual([0.3, 1.3, 2.3, 3.3, 3.8]);
    });

    it('lists only skills used in the range, most used first', () => {
      expect(build().skillUsage.series.map((s) => s.name)).toEqual([
        'Angular',
        'NgRx',
        'Java',
        'Claude',
      ]);
      expect(build({ from: 2022, to: 2024 }).skillUsage.series.map((s) => s.name)).toEqual([
        'Angular',
        'NgRx',
      ]);
    });

    it('restricts the range: a 2022–2024 window counts only those years', () => {
      const angular = series(build({ from: 2022, to: 2024 }), 'Angular');
      expect(angular?.monthsPerYear).toEqual([4, 12, 12]);
      expect(angular?.totalYears).toBe(2.3);
    });

    it('filters by category or by skill', () => {
      expect(build({ category: 'State' }).skillUsage.series.map((s) => s.name)).toEqual(['NgRx']);
      expect(build({ skill: 'java' }).skillUsage.series.map((s) => s.name)).toEqual(['Java']);
    });

    it('ignores projects without dates', () => {
      expect(series(build(), 'React')).toBeUndefined();
    });
  });

  describe('skills over time (the line chart)', () => {
    const names = (d: ReturnType<typeof build>) => d.skillsOverTime.series.map((s) => s.name);
    const withSelection = (skillsOverTime: string[], query = {}) =>
      buildDashboard({ resume: resumeFixture(), today: TODAY, query, skillsOverTime });

    /** Ten skills "s1".."s10" all used by one job, s1 the longest and s10 the shortest (hand-checkable ranking). */
    function crowdedResume(): ResumeResponse {
      const resume = resumeFixture();
      const ids = Array.from({ length: 10 }, (_, i) => `sk-s${i + 1}`);
      resume.skills = ids.map((id, i) => ({
        id,
        name: `S${i + 1}`,
        slug: `s${i + 1}`,
        category: 'Crowd',
        level: null,
        sortOrder: i,
      }));
      resume.projects = [];
      resume.experiences = ids.map((id, i) => ({
        ...resume.experiences[0],
        id: `e-${id}`,
        company: `C${i + 1}`,
        // s1 starts in 2016, s2 in 2017, ... so s1 is used the most.
        startDate: `${2016 + i}-01-01`,
        endDate: '2026-01-31',
        skillIds: [id],
        highlights: [],
      }));
      return resume;
    }

    it('is automatic without a selection: every used skill, most used first', () => {
      const d = build();
      expect(d.skillsOverTime.mode).toBe('auto');
      expect(names(d)).toEqual(['Angular', 'NgRx', 'Java', 'Claude']);
      expect(d.skillsOverTime.years).toEqual(d.skillUsage.years);
      expect(d.skillsOverTime.series).toEqual(d.skillUsage.series);
    });

    it.each([
      ['an empty selection', []],
      ['a selected skill that is never used', ['sk-react']],
      ['an unknown (deleted) skill id', ['sk-gone']],
    ])('is automatic for %s', (_, selection) => {
      const d = withSelection(selection);
      expect(d.skillsOverTime.mode).toBe('auto');
      expect(names(d)).toEqual(['Angular', 'NgRx', 'Java', 'Claude']);
    });

    it('caps the automatic lines at the 8 most used skills', () => {
      const d = buildDashboard({ resume: crowdedResume(), today: TODAY, query: {} });
      expect(d.skillUsage.series).toHaveLength(10);
      expect(d.skillsOverTime.mode).toBe('auto');
      expect(names(d)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
      expect(d.skillsOverTime.series).toEqual(d.skillUsage.series.slice(0, 8));
    });

    it('shows the selected skills, in usage order and not in selection order', () => {
      const d = withSelection(['sk-claude', 'sk-angular']);
      expect(d.skillsOverTime.mode).toBe('selected');
      expect(names(d)).toEqual(['Angular', 'Claude']);
      expect(d.skillsOverTime.series).toEqual([d.skillUsage.series[0], d.skillUsage.series[3]]);
      expect(d.skillsOverTime.years).toEqual(d.skillUsage.years);
    });

    it('shows a selected skill even when it is not among the 8 most used', () => {
      const d = buildDashboard({
        resume: crowdedResume(),
        today: TODAY,
        query: {},
        skillsOverTime: ['sk-s10', 'sk-s9'],
      });
      expect(d.skillsOverTime.mode).toBe('selected');
      expect(names(d)).toEqual(['S9', 'S10']);
    });

    it('never draws more than the limit, even if given a longer selection', () => {
      const resume = crowdedResume();
      const d = buildDashboard({
        resume,
        today: TODAY,
        query: {},
        skillsOverTime: resume.skills.map((s) => s.id),
      });
      expect(d.skillsOverTime.mode).toBe('selected');
      expect(names(d)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
    });

    // Java was only used at Capgemini, 2011-2013.
    it.each<[string, string[], DashboardQuery, 'selected' | 'auto', string[]]>([
      [
        'the category filter keeps NgRx',
        ['sk-angular', 'sk-ngrx', 'sk-claude'],
        { category: 'State' },
        'selected',
        ['NgRx'],
      ],
      [
        'the skill filter keeps Java',
        ['sk-angular', 'sk-java'],
        { skill: 'java' },
        'selected',
        ['Java'],
      ],
      [
        'the category filter keeps none: automatic',
        ['sk-angular'],
        { category: 'Languages' },
        'auto',
        ['Java'],
      ],
      [
        'the skill filter keeps none: automatic',
        ['sk-angular', 'sk-claude'],
        { skill: 'java' },
        'auto',
        ['Java'],
      ],
      [
        'the range drops Java, NgRx stays',
        ['sk-java', 'sk-ngrx'],
        { from: 2022, to: 2024 },
        'selected',
        ['NgRx'],
      ],
      [
        'the range drops the whole selection: automatic',
        ['sk-java'],
        { from: 2022, to: 2024 },
        'auto',
        ['Angular', 'NgRx'],
      ],
      [
        'an unknown id next to a used skill is ignored',
        ['sk-gone', 'sk-java'],
        {},
        'selected',
        ['Java'],
      ],
    ])('selection and view: %s', (_, selection, query, mode, expected) => {
      const d = withSelection(selection, query);
      expect(d.skillsOverTime.mode).toBe(mode);
      expect(names(d)).toEqual(expected);
    });

    it('does not change skillUsage', () => {
      const plain = build();
      expect(withSelection(['sk-claude']).skillUsage).toEqual(plain.skillUsage);
      expect(withSelection(['sk-claude']).skillTotals).toEqual(plain.skillTotals);
    });

    it('is empty only when no skill is used in the view', () => {
      const empty = buildDashboard({
        resume: { ...resumeFixture(), skills: [], experiences: [], projects: [], education: [] },
        today: TODAY,
        query: {},
        skillsOverTime: ['sk-angular'],
      });
      expect(empty.skillsOverTime.mode).toBe('auto');
      expect(empty.skillsOverTime.series).toEqual([]);
      expect(empty.skillsOverTime.years).toEqual(empty.skillUsage.years);
    });
  });

  describe('skill totals (bar gauge)', () => {
    it('groups used skills by category (skills-list order), most years first', () => {
      expect(build().skillTotals).toEqual([
        {
          category: 'Core',
          skills: [
            { skillId: 'sk-angular', slug: 'angular', name: 'Angular', years: 3.8, level: null },
          ],
        },
        {
          category: 'State',
          skills: [{ skillId: 'sk-ngrx', slug: 'ngrx', name: 'NgRx', years: 3.3, level: null }],
        },
        {
          category: 'Languages',
          skills: [{ skillId: 'sk-java', slug: 'java', name: 'Java', years: 1.9, level: null }],
        },
        {
          category: 'AI',
          skills: [
            { skillId: 'sk-claude', slug: 'claude', name: 'Claude', years: 0.5, level: null },
          ],
        },
      ]);
    });
  });

  describe('stats', () => {
    const stat = (d: ReturnType<typeof build>, key: string) => d.stats.find((s) => s.key === key);

    it('uses the hand-entered headline figures and the first job year', () => {
      const d = build();
      expect(d.stats.map((s) => s.key)).toEqual([
        'yearsInIt',
        'yearsOfAngular',
        'uptime',
        'jobs',
        'technologies',
        'achievements',
      ]);
      expect(stat(d, 'yearsInIt')).toMatchObject({ value: 14, display: '14+' });
      expect(stat(d, 'yearsOfAngular')).toMatchObject({ value: 9, display: '9+' });
      expect(stat(d, 'uptime')).toMatchObject({
        value: 2011,
        display: 'since 2011',
        hint: '15 years',
      });
    });

    it('counts jobs, technologies and achievements within the range and filters', () => {
      expect([
        stat(build(), 'jobs')?.value,
        stat(build(), 'technologies')?.value,
        stat(build(), 'achievements')?.value,
      ]).toEqual([3, 4, 3]);
      const window = build({ from: 2022, to: 2024 });
      expect([
        stat(window, 'jobs')?.value,
        stat(window, 'technologies')?.value,
        stat(window, 'achievements')?.value,
      ]).toEqual([1, 2, 0]);
      const angular = build({ skill: 'angular' });
      expect([stat(angular, 'jobs')?.value, stat(angular, 'achievements')?.value]).toEqual([2, 3]);
    });

    it('does not let the range change the headline figures', () => {
      expect(stat(build({ from: 2024, to: 2024 }), 'yearsInIt')?.value).toBe(14);
    });
  });

  describe('status', () => {
    it('is "employed" at the company of the job without an end date', () => {
      expect(build().status).toEqual({
        state: 'employed',
        company: 'Whoz',
        openToRelocation: true,
      });
    });

    it('is "open to work" when every job has ended', () => {
      const resume = resumeFixture();
      resume.experiences = resume.experiences.filter((e) => e.endDate !== null);
      expect(buildDashboard({ resume, today: TODAY, query: {} }).status).toEqual({
        state: 'open-to-work',
        company: null,
        openToRelocation: true,
      });
    });
  });

  describe('timeline', () => {
    it('lists jobs and education by start date, without gap markers', () => {
      expect(build().timeline.map((t) => [t.kind, t.label])).toEqual([
        ['education', 'ESIL'],
        ['job', 'Capgemini'],
        ['job', 'KX'],
        ['job', 'Whoz'],
      ]);
      expect(build().timeline.find((t) => t.label === 'Whoz')).toMatchObject({
        endDate: null,
        sublabel: 'Engineer',
      });
    });

    it('keeps the items that overlap the range', () => {
      expect(build({ from: 2014 }).timeline.map((t) => t.label)).toEqual(['KX', 'Whoz']);
    });

    it('keeps only the jobs using the selected skill (education stays)', () => {
      expect(build({ skill: 'java' }).timeline.map((t) => t.label)).toEqual(['ESIL', 'Capgemini']);
    });
  });

  describe('impacts and latest highlights', () => {
    it('lists quantified achievements in the range, newest first', () => {
      expect(build().impacts.map((i) => [i.company, i.impact.metric])).toEqual([
        ['Whoz', 'Code generated with Claude'],
        ['KX', 'Page load time'],
      ]);
      expect(build({ to: 2025 }).impacts.map((i) => i.company)).toEqual(['KX']);
    });

    it('gives the 5 newest highlights as log lines (same day: resume order)', () => {
      expect(build().latestHighlights.map((l) => [l.date, l.level, l.company])).toEqual([
        ['2026-10-22', 'achievement', 'Whoz'],
        ['2025-11-30', 'achievement', 'KX'],
        ['2025-11-30', 'milestone', 'KX'],
      ]);
    });
  });

  it('passes the public profile through', () => {
    expect(build().profile?.fullName).toBe('Pierre Dugue');
  });

  it('works on an empty resume', () => {
    const d = buildDashboard({
      resume: { profile: null, experiences: [], education: [], skills: [], projects: [] },
      today: TODAY,
      query: {},
    });
    expect(d.range).toEqual({ from: 2026, to: 2026 });
    expect(d.status.state).toBe('open-to-work');
    expect(d.stats.find((s) => s.key === 'yearsInIt')).toMatchObject({ value: 0, display: '–' });
  });
});
