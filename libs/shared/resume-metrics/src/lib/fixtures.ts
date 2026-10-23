import type { Experience, ResumeResponse, Skill } from '@my-resume/api-models';

const skill = (id: string, name: string, category: string, sortOrder: number): Skill => ({
  id,
  name,
  slug: name.toLowerCase(),
  category,
  level: null,
  sortOrder,
});

export const TODAY = '2026-10-22';

export const SKILLS = {
  angular: skill('sk-angular', 'Angular', 'Core', 0),
  ngrx: skill('sk-ngrx', 'NgRx', 'State', 1),
  java: skill('sk-java', 'Java', 'Languages', 2),
  claude: skill('sk-claude', 'Claude', 'AI', 3),
  react: skill('sk-react', 'React', 'Core', 4), // never used
};

const exp = (
  e: Partial<Experience> & Pick<Experience, 'id' | 'company' | 'startDate'>,
): Experience => ({
  role: 'Engineer',
  location: null,
  endDate: null,
  summary: null,
  skillIds: [],
  highlights: [],
  sortOrder: 0,
  ...e,
});

/** Small resume where every number can be checked by hand. */
export function resumeFixture(): ResumeResponse {
  return {
    profile: {
      fullName: 'Pierre Dugue',
      headline: 'Senior Front-End Engineer',
      summary: 'Summary',
      email: 'p@example.com',
      phone: null,
      location: 'Nice, France',
      openToRelocation: true,
      avatarUrl: null,
      links: [],
      interests: null,
      yearsInIt: 14,
      yearsOfAngular: 9,
    },
    skills: Object.values(SKILLS),
    experiences: [
      exp({
        id: 'e-whoz',
        company: 'Whoz',
        startDate: '2026-05-01',
        endDate: null,
        skillIds: ['sk-angular', 'sk-claude'],
        highlights: [
          {
            id: 'h-whoz',
            date: '2026-10-22',
            level: 'achievement',
            message: 'Generate 95% of code with Claude.',
            impact: {
              metric: 'Code generated with Claude',
              before: null,
              after: 95,
              changePct: null,
              unit: '%',
              direction: 'up-is-good',
            },
            labels: {},
            skillIds: ['sk-claude'],
            sortOrder: 0,
          },
        ],
      }),
      exp({
        id: 'e-kx',
        company: 'KX',
        role: 'Front-End Engineer',
        location: 'Full Remote',
        startDate: '2022-09-01',
        endDate: '2025-11-30',
        skillIds: ['sk-angular', 'sk-ngrx'],
        highlights: [
          {
            id: 'h-kx-1',
            date: '2025-11-30',
            level: 'achievement',
            message: 'Cut page load time by 35%.',
            impact: {
              metric: 'Page load time',
              before: null,
              after: null,
              changePct: -35,
              unit: '%',
              direction: 'down-is-good',
            },
            labels: { team: 'platform' },
            skillIds: ['sk-angular', 'sk-ngrx'],
            sortOrder: 0,
          },
          {
            id: 'h-kx-2',
            date: '2025-11-30',
            level: 'milestone',
            message: 'Introduced NX.',
            impact: null,
            labels: {},
            skillIds: [],
            sortOrder: 1,
          },
        ],
      }),
      exp({
        id: 'e-capgemini',
        company: 'Capgemini',
        startDate: '2011-09-01',
        endDate: '2013-07-31',
        skillIds: ['sk-java'],
      }),
    ],
    education: [
      {
        id: 'ed-esil',
        school: 'ESIL',
        degree: 'Engineering degree',
        field: null,
        location: null,
        startDate: '2008-09-01',
        endDate: '2011-06-30',
        description: null,
        sortOrder: 0,
      },
    ],
    projects: [
      {
        id: 'p-site',
        slug: 'site',
        title: 'This site',
        description: 'd',
        url: null,
        repoUrl: null,
        imageUrl: null,
        startDate: '2026-10-21',
        endDate: null,
        skillIds: ['sk-angular'],
        // Root: 2026-10-21 → today (2026-10-22), 2 days.
        spans: [
          {
            id: 'sp-design',
            parentId: null,
            depth: 0,
            name: 'Design',
            startDate: '2026-10-21',
            endDate: '2026-10-21',
            note: 'The spec.',
            skillIds: [],
            sortOrder: 0,
          },
          {
            id: 'sp-front',
            parentId: null,
            depth: 0,
            name: 'Frontend',
            startDate: '2026-10-21',
            endDate: null,
            note: null,
            skillIds: ['sk-angular', 'sk-ngrx'],
            sortOrder: 1,
          },
          {
            id: 'sp-dash',
            parentId: 'sp-front',
            depth: 1,
            name: 'Dashboard',
            startDate: '2026-10-22',
            endDate: '2026-10-22',
            note: null,
            skillIds: ['sk-claude'],
            sortOrder: 2,
          },
        ],
        sortOrder: 0,
      },
      {
        id: 'p-undated',
        slug: 'undated',
        title: 'Undated',
        description: 'd',
        url: null,
        repoUrl: null,
        imageUrl: null,
        startDate: null,
        endDate: null,
        skillIds: ['sk-react'],
        spans: [],
        sortOrder: 1,
      },
    ],
  };
}
