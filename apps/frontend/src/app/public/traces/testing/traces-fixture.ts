import type { Trace, TraceSummary } from '@my-resume/api-models';

/** A 4-day project (Oct 21 → 24): Spec, then Features > Auth, ongoing. */
export function traceFixture(): Trace {
  return {
    slug: 'pierre-o11y',
    title: 'Pierre O11y',
    description: 'This site.',
    url: 'https://example.com',
    repoUrl: null,
    spans: [
      {
        id: 'p-site',
        parentId: null,
        depth: 0,
        name: 'Pierre O11y',
        startDate: '2026-10-21',
        endDate: '2026-10-24',
        ongoing: true,
        durationDays: 4,
        offset: 0,
        width: 1,
        note: 'This site.',
        tech: [{ slug: 'angular', name: 'Angular' }],
      },
      {
        id: 'sp-spec',
        parentId: 'p-site',
        depth: 1,
        name: 'Specification',
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        ongoing: false,
        durationDays: 1,
        offset: 0,
        width: 0.25,
        note: 'The spec.',
        tech: [],
      },
      {
        id: 'sp-features',
        parentId: 'p-site',
        depth: 1,
        name: 'Features',
        startDate: '2026-10-22',
        endDate: '2026-10-24',
        ongoing: true,
        durationDays: 3,
        offset: 0.25,
        width: 0.75,
        note: null,
        tech: [
          { slug: 'angular', name: 'Angular' },
          { slug: 'nestjs', name: 'NestJS' },
        ],
      },
      {
        id: 'sp-auth',
        parentId: 'sp-features',
        depth: 2,
        name: 'Auth',
        startDate: '2026-10-22',
        endDate: '2026-10-22',
        ongoing: false,
        durationDays: 1,
        offset: 0.25,
        width: 0.25,
        note: null,
        tech: [{ slug: 'nestjs', name: 'NestJS' }],
      },
    ],
  };
}

export function traceSummariesFixture(): TraceSummary[] {
  return [
    {
      slug: 'pierre-o11y',
      title: 'Pierre O11y',
      startDate: '2026-10-21',
      endDate: '2026-10-24',
      ongoing: true,
      durationDays: 4,
      spanCount: 3,
      tech: ['Angular', 'NestJS'],
    },
    {
      slug: 'childcare',
      title: 'Childcare',
      startDate: '2025-10-01',
      endDate: '2025-12-15',
      ongoing: false,
      durationDays: 76,
      spanCount: 0,
      tech: [],
    },
  ];
}
