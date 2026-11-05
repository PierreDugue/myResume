import type { DashboardQuery, ResumeResponse } from '@my-resume/api-models';
import { buildDashboard, DashboardQueryError } from './dashboard';
import { resumeFixture, SKILLS, TODAY } from './fixtures';

const build = (query = {}) => buildDashboard({ resume: resumeFixture(), today: TODAY, query });
const series = (d: ReturnType<typeof build>, name: string) =>
  d.skillUsage.series.find((s) => s.name === name);

/**
 * The fixture with its skills listed in reverse (sortOrder renumbered to match) and the undated
 * project dated Jan–Mar 2026, so React is used 3 months. Neither the skills list nor the usage order
 * agrees with the fixture's order any more, so sorting and grouping are really exercised.
 */
function reorderedSkillsResume(): ResumeResponse {
  const resume = resumeFixture();
  resume.skills = Object.values(SKILLS)
    .reverse()
    .map((s, i) => ({ ...s, sortOrder: i }));
  resume.projects = resume.projects.map((p) =>
    p.id === 'p-undated' ? { ...p, startDate: '2026-01-01', endDate: '2026-03-31' } : p,
  );
  return resume;
}

/** The fixture with its jobs listed oldest first (the fixture has them newest first). */
function oldestFirstResume(): ResumeResponse {
  const resume = resumeFixture();
  resume.experiences.reverse();
  return resume;
}

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

    it('accepts the bounds themselves: 1950 and 2100', () => {
      expect(build({ from: 1950, to: 2100 }).range).toEqual({ from: 1950, to: 2100 });
    });

    it.each([
      ['from after to', { from: 2025, to: 2020 }],
      ['a year before 1950', { from: 1949 }],
      ['a year after 2100', { to: 2101 }],
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

    it('restricts to the range and gives the all-time experience at the end of each year', () => {
      // Java: Capgemini Sep 2011–Jul 2013. In 2013 it has 7 months (Jan–Jul), in 2014 none.
      // All-time at the end of 2013: 4 (2011) + 12 (2012) + 7 = 23 months = 1.9 years.
      const java = series(build({ from: 2013, to: 2014 }), 'Java');
      expect(java?.monthsPerYear).toEqual([7, 0]);
      expect(java?.totalYears).toBe(0.6);
      expect(java?.cumulativeYears).toEqual([1.9, 1.9]);
    });

    it('accumulates the all-time experience year by year, below the total when use goes on after the range', () => {
      // Angular: 4 months in 2022 (Sep–Dec) before the range, then 12 (2023), 12 (2024), 11 (2025).
      // All-time at the end of each year: 16 months = 1.3, 28 = 2.3, 39 = 3.25 -> 3.3 years.
      // The range total is only 35 months = 2.9 years, and Whoz (2026) keeps it going after 2025.
      const angular = series(build({ from: 2023, to: 2025 }), 'Angular');
      expect(angular?.monthsPerYear).toEqual([12, 12, 11]);
      expect(angular?.cumulativeYears).toEqual([1.3, 2.3, 3.3]);
      expect(angular?.totalYears).toBe(2.9);
    });

    it('lists only skills used in the range, most used first (not in skills-list order)', () => {
      // Months: Angular 45, NgRx 39, Java 23, Claude 6, React 3; the skills list is the reverse.
      const resume = reorderedSkillsResume();
      const names = (query = {}) =>
        buildDashboard({ resume, today: TODAY, query }).skillUsage.series.map((s) => s.name);
      expect(names()).toEqual(['Angular', 'NgRx', 'Java', 'Claude', 'React']);
      // Angular and NgRx both have 28 months in 2022–2024: the tie goes to the lower sortOrder.
      expect(build({ from: 2022, to: 2024 }).skillUsage.series.map((s) => s.name)).toEqual([
        'Angular',
        'NgRx',
      ]);
      // Same tie with the sortOrders swapped while the list keeps Angular first: sortOrder decides.
      const swapped = resumeFixture();
      swapped.skills = swapped.skills.map((s) =>
        s.slug === 'angular'
          ? { ...s, sortOrder: 1 }
          : s.slug === 'ngrx'
            ? { ...s, sortOrder: 0 }
            : s,
      );
      const tied = buildDashboard({
        resume: swapped,
        today: TODAY,
        query: { from: 2022, to: 2024 },
      });
      expect(tied.skillUsage.series.map((s) => s.name)).toEqual(['NgRx', 'Angular']);
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
    const withSelection = (skillsOverTime: string[] | undefined, query = {}) =>
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

    it.each<[string, string[] | undefined]>([
      ['no selection', undefined],
      ['an empty selection', []],
      ['a selected skill that is never used', ['sk-react']],
      ['an unknown (deleted) skill id', ['sk-gone']],
    ])('is automatic for %s: every used skill, most used first', (_, selection) => {
      const d = withSelection(selection);
      expect(d.skillsOverTime).toEqual({
        mode: 'auto',
        years: d.skillUsage.years,
        series: d.skillUsage.series,
      });
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

    // Java was only used at Capgemini, 2011-2013. The default range is 2011-2026 (first job to now),
    // and filters.minYear is 2008 (education). Only the whole-career view draws the selection.
    it.each<[string, string[], DashboardQuery, 'selected' | 'auto', string[]]>([
      // A filter ignores the selection, even when it keeps every selected skill.
      [
        'the category filter ignores the selection, even when it keeps every selected skill',
        ['sk-ngrx'],
        { category: 'State' },
        'auto',
        ['NgRx'],
      ],
      [
        'the skill filter ignores the selection, even when it keeps Java',
        ['sk-angular', 'sk-java'],
        { skill: 'java' },
        'auto',
        ['Java'],
      ],
      // Only a range that isn't narrower than the whole career keeps the selection.
      [
        'explicit default years are still the whole career: selected',
        ['sk-java', 'sk-claude'],
        { from: 2011, to: 2026 },
        'selected',
        ['Java', 'Claude'],
      ],
      [
        'a wider range (from filters.minYear) is still the whole career: selected',
        ['sk-java', 'sk-claude'],
        { from: 2008 },
        'selected',
        ['Java', 'Claude'],
      ],
      [
        'a later end year than the current year is still the whole career: selected',
        ['sk-java'],
        { to: 2030 },
        'selected',
        ['Java'],
      ],
      [
        'only from narrowed (2012) is a filter: automatic',
        ['sk-claude'],
        { from: 2012 },
        'auto',
        ['Angular', 'NgRx', 'Java', 'Claude'],
      ],
      [
        'only to narrowed (2025) is a filter: automatic',
        ['sk-ngrx'],
        { to: 2025 },
        'auto',
        ['Angular', 'NgRx', 'Java'],
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

    it('keeps the selection with no experience: the career starts at the current year', () => {
      // No job, so the default range is 2026–2026, which is still the whole career.
      const resume = resumeFixture();
      resume.experiences = [];
      resume.projects = [
        {
          ...resume.projects[0],
          id: 'p-solo',
          startDate: '2025-11-01',
          endDate: '2026-02-28',
          skillIds: ['sk-angular'],
          spans: [],
        },
      ];
      const d = buildDashboard({ resume, today: TODAY, query: {}, skillsOverTime: ['sk-angular'] });
      expect(d.range).toEqual({ from: 2026, to: 2026 });
      expect(d.skillsOverTime.mode).toBe('selected');
      expect(names(d)).toEqual(['Angular']);
    });

    it('does not change skillUsage', () => {
      const plain = build();
      expect(withSelection(['sk-claude']).skillUsage).toEqual(plain.skillUsage);
      expect(withSelection(['sk-claude']).skillTotals).toEqual(plain.skillTotals);
    });
  });

  describe('skill totals (bar gauge)', () => {
    it('groups used skills by category (skills-list order), most years first', () => {
      // The skills list is reversed: Core (React, Angular) comes first, then AI, Languages, State.
      const resume = reorderedSkillsResume();
      expect(buildDashboard({ resume, today: TODAY, query: {} }).skillTotals).toEqual([
        {
          category: 'Core',
          skills: [
            { skillId: 'sk-angular', slug: 'angular', name: 'Angular', years: 3.8, level: null },
            { skillId: 'sk-react', slug: 'react', name: 'React', years: 0.3, level: null },
          ],
        },
        {
          category: 'AI',
          skills: [
            { skillId: 'sk-claude', slug: 'claude', name: 'Claude', years: 0.5, level: null },
          ],
        },
        {
          category: 'Languages',
          skills: [{ skillId: 'sk-java', slug: 'java', name: 'Java', years: 1.9, level: null }],
        },
        {
          category: 'State',
          skills: [{ skillId: 'sk-ngrx', slug: 'ngrx', name: 'NgRx', years: 3.3, level: null }],
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
      expect(stat(build({ from: 2024, to: 2024 }), 'uptime')).toMatchObject({
        value: 2011,
        display: 'since 2011',
        hint: '15 years',
      });
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
    it('lists quantified achievements in the range, newest first (jobs listed oldest first)', () => {
      const resume = oldestFirstResume();
      const impacts = (query = {}) => buildDashboard({ resume, today: TODAY, query }).impacts;
      expect(impacts().map((i) => [i.company, i.impact.metric])).toEqual([
        ['Whoz', 'Code generated with Claude'],
        ['KX', 'Page load time'],
      ]);
      expect(impacts({ to: 2025 }).map((i) => i.company)).toEqual(['KX']);
    });

    it('gives the 5 newest highlights as log lines, newest first (same day: resume order)', () => {
      // Six highlights in the range, jobs oldest first and dates out of order: the oldest is dropped.
      const resume = oldestFirstResume();
      const highlight = (id: string, date: string, level: 'achievement' | 'milestone') => ({
        id,
        date,
        level,
        message: id,
        impact: null,
        labels: {},
        skillIds: [],
        sortOrder: 9,
      });
      const byCompany = (company: string) => resume.experiences.find((e) => e.company === company)!;
      byCompany('Capgemini').highlights = [
        highlight('h-c-1', '2013-06-30', 'milestone'),
        highlight('h-c-2', '2012-05-05', 'achievement'),
      ];
      byCompany('Whoz').highlights.push(highlight('h-whoz-2', '2026-07-01', 'milestone'));

      const lines = buildDashboard({ resume, today: TODAY, query: {} }).latestHighlights;
      expect(lines.map((l) => [l.date, l.level, l.company])).toEqual([
        ['2026-10-22', 'achievement', 'Whoz'],
        ['2026-07-01', 'milestone', 'Whoz'],
        ['2025-11-30', 'achievement', 'KX'],
        ['2025-11-30', 'milestone', 'KX'],
        ['2013-06-30', 'milestone', 'Capgemini'],
      ]);
    });
  });

  it('works on an empty resume', () => {
    const d = buildDashboard({
      resume: { profile: null, experiences: [], education: [], skills: [], projects: [] },
      today: TODAY,
      query: {},
      skillsOverTime: ['sk-angular'],
    });
    expect(d.range).toEqual({ from: 2026, to: 2026 });
    expect(d.status.state).toBe('open-to-work');
    expect(d.stats.find((s) => s.key === 'yearsInIt')).toMatchObject({ value: 0, display: '–' });
    // A stale selection of a skill that no longer exists falls back to automatic.
    expect(d.skillsOverTime).toEqual({ mode: 'auto', years: [2026], series: [] });
  });
});
