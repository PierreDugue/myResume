import type { ServiceMapResponse } from '@my-resume/api-models';

/** Two jobs, a project and three skills. */
export function serviceMapFixture(): ServiceMapResponse {
  return {
    nodes: [
      { id: 'job:e-whoz', kind: 'job', label: 'Whoz', years: 0.5, slug: null, category: null },
      { id: 'job:e-kx', kind: 'job', label: 'KX', years: 3.3, slug: null, category: null },
      {
        id: 'project:p-site',
        kind: 'project',
        label: 'Pierre O11y',
        years: 0.1,
        slug: 'pierre-o11y',
        category: null,
      },
      {
        id: 'skill:sk-angular',
        kind: 'skill',
        label: 'Angular',
        years: 9,
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
        id: 'skill:sk-claude',
        kind: 'skill',
        label: 'Claude',
        years: 0.5,
        slug: 'claude',
        category: 'AI',
      },
    ],
    edges: [
      { source: 'job:e-whoz', target: 'skill:sk-angular' },
      { source: 'job:e-whoz', target: 'skill:sk-claude' },
      { source: 'job:e-kx', target: 'skill:sk-angular' },
      { source: 'job:e-kx', target: 'skill:sk-ngrx' },
      { source: 'project:p-site', target: 'skill:sk-angular' },
    ],
  };
}
