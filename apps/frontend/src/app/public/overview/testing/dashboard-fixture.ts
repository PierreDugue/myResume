import type { DashboardResponse } from '@my-resume/api-models';

/** A small but complete dashboard response for component tests. */
export function dashboardFixture(): DashboardResponse {
  return {
    range: { from: 2011, to: 2026 },
    applied: { category: null, skill: null },
    filters: {
      minYear: 2008,
      maxYear: 2026,
      categories: ['Core', 'State'],
      skills: [
        { slug: 'angular', name: 'Angular', category: 'Core' },
        { slug: 'ngrx', name: 'NgRx', category: 'State' },
      ],
    },
    profile: {
      fullName: 'Pierre Dugue',
      headline: 'Senior Front-End Engineer',
      summary: 'Summary text.',
      email: 'p@example.com',
      phone: null,
      location: 'Nice, France',
      openToRelocation: true,
      avatarUrl: null,
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' }],
      interests: null,
      yearsInIt: 14,
      yearsOfAngular: 9,
    },
    status: { state: 'employed', company: 'Whoz', openToRelocation: true },
    stats: [
      { key: 'yearsInIt', label: 'Years in IT', value: 14, display: '14+', hint: null },
      { key: 'yearsOfAngular', label: 'Years of Angular', value: 9, display: '9+', hint: null },
      { key: 'uptime', label: 'Uptime', value: 2011, display: 'since 2011', hint: '15 years' },
      { key: 'jobs', label: 'Jobs', value: 3, display: '3', hint: null },
      { key: 'technologies', label: 'Technologies', value: 2, display: '2', hint: null },
      { key: 'achievements', label: 'Achievements', value: 3, display: '3', hint: null },
    ],
    impacts: [
      {
        highlightId: 'h-1',
        company: 'KX',
        date: '2025-11-30',
        message: 'Cut page load time by 35%.',
        impact: {
          metric: 'Page load time',
          before: null,
          after: null,
          changePct: -35,
          unit: '%',
          direction: 'down-is-good',
        },
      },
      {
        highlightId: 'h-2',
        company: 'KX',
        date: '2025-11-30',
        message: 'Coverage from under 20% to over 75%.',
        impact: {
          metric: 'Code coverage',
          before: 20,
          after: 75,
          changePct: null,
          unit: '%',
          direction: 'up-is-good',
        },
      },
    ],
    timeline: [
      {
        id: 'ed',
        kind: 'education',
        label: 'ESIL',
        sublabel: 'Engineering degree',
        startDate: '2008-09-01',
        endDate: '2011-06-30',
      },
      {
        id: 'cap',
        kind: 'job',
        label: 'Capgemini',
        sublabel: 'Engineer',
        startDate: '2011-09-01',
        endDate: '2013-07-31',
      },
      {
        id: 'kx',
        kind: 'job',
        label: 'KX',
        sublabel: 'Engineer',
        startDate: '2022-09-01',
        endDate: '2025-11-30',
      },
      {
        id: 'whoz',
        kind: 'job',
        label: 'Whoz',
        sublabel: 'Engineer',
        startDate: '2026-05-01',
        endDate: null,
      },
    ],
    skillUsage: {
      years: [2024, 2025, 2026],
      series: [
        {
          skillId: 'a',
          slug: 'angular',
          name: 'Angular',
          category: 'Core',
          monthsPerYear: [12, 11, 6],
          cumulativeYears: [2.3, 3.3, 3.8],
          totalYears: 2.4,
        },
        {
          skillId: 'n',
          slug: 'ngrx',
          name: 'NgRx',
          category: 'State',
          monthsPerYear: [12, 11, 0],
          cumulativeYears: [2.3, 3.3, 3.3],
          totalYears: 1.9,
        },
      ],
    },
    skillTotals: [
      {
        category: 'Core',
        skills: [{ skillId: 'a', slug: 'angular', name: 'Angular', years: 2.4, level: 5 }],
      },
      {
        category: 'State',
        skills: [{ skillId: 'n', slug: 'ngrx', name: 'NgRx', years: 1.9, level: null }],
      },
    ],
    latestHighlights: [
      {
        id: 'l1',
        date: '2026-10-22',
        level: 'achievement',
        message: 'Generate 95% of code with Claude.',
        company: 'Whoz',
      },
      {
        id: 'l2',
        date: '2025-11-30',
        level: 'milestone',
        message: 'Introduced NX.',
        company: 'KX',
      },
    ],
  };
}

export const TEST_PALETTE = {
  series: ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006'],
  text: '#eeeeee',
  muted: '#999999',
  border: '#333333',
  surface: '#111111',
  accent: '#ff8800',
};
