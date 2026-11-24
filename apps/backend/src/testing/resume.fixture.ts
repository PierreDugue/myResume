import type { ResumeResponse } from '@my-resume/api-models';

/** The date the fixtures are read on. */
export const FIXTURE_TODAY = '2026-10-22';

/**
 * A small resume where every count can be checked by hand. Ids all start with `ZZID-`, so a test
 * can check that no id reaches a prompt. It makes 4 log lines, newest first:
 *   2025-06-10 experience  Acme    "Cut build time by 40%."        {team: platform}, tech Angular
 *   2023-01-01 project     Engine  "Engine: A mechanical computer." tech Angular
 *   2020-05-05 experience  Globex  "Shipped the billing engine."   tech Java
 *   2018-06-30 education   MIT     "Graduated: BSc, Maths"
 * So 2 `type="experience"` lines and 1 line each for the other types.
 */
export function assistantResumeFixture(): ResumeResponse {
  return {
    profile: {
      fullName: 'Ada Lovelace',
      headline: 'Analytical Engine Programmer',
      summary: 'Wrote the first program.',
      email: 'ada@example.com',
      phone: null,
      location: 'London',
      openToRelocation: false,
      avatarUrl: null,
      links: [],
      interests: null,
      yearsInIt: 12,
      yearsOfAngular: null,
    },
    skills: [
      {
        id: 'ZZID-sk-angular',
        name: 'Angular',
        slug: 'angular',
        category: 'Frameworks',
        level: null,
        sortOrder: 0,
      },
      {
        id: 'ZZID-sk-java',
        name: 'Java',
        slug: 'java',
        category: 'Languages',
        level: null,
        sortOrder: 1,
      },
    ],
    experiences: [
      {
        id: 'ZZID-exp-acme',
        company: 'Acme',
        role: 'Lead Developer',
        location: null,
        startDate: '2024-03-01',
        endDate: null,
        summary: null,
        skillIds: ['ZZID-sk-angular'],
        highlights: [
          {
            id: 'ZZID-h-acme',
            date: '2025-06-10',
            level: 'achievement',
            message: 'Cut build time by 40%.',
            impact: null,
            labels: { team: 'platform' },
            skillIds: ['ZZID-sk-angular'],
            sortOrder: 0,
          },
        ],
        sortOrder: 0,
      },
      {
        id: 'ZZID-exp-globex',
        company: 'Globex',
        role: 'Developer',
        location: 'Paris',
        startDate: '2019-01-01',
        endDate: '2021-12-31',
        summary: null,
        skillIds: ['ZZID-sk-java'],
        highlights: [
          {
            id: 'ZZID-h-globex',
            date: '2020-05-05',
            level: 'info',
            message: 'Shipped the billing engine.',
            impact: null,
            labels: {},
            skillIds: ['ZZID-sk-java'],
            sortOrder: 0,
          },
        ],
        sortOrder: 1,
      },
    ],
    education: [
      {
        id: 'ZZID-ed-mit',
        school: 'MIT',
        degree: 'BSc',
        field: 'Maths',
        location: null,
        startDate: '2015-09-01',
        endDate: '2018-06-30',
        description: null,
        sortOrder: 0,
      },
    ],
    projects: [
      {
        id: 'ZZID-p-engine',
        slug: 'engine',
        title: 'Engine',
        description: 'A mechanical computer.',
        url: null,
        repoUrl: null,
        imageUrl: null,
        startDate: '2023-01-01',
        endDate: null,
        skillIds: ['ZZID-sk-angular'],
        spans: [],
        sortOrder: 0,
      },
    ],
  };
}
