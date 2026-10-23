import type { LogLabel, LogsResponse } from '@my-resume/api-models';

/** Three lines over 2024–2026, one per level kind, checkable by hand. */
export function logsFixture(): LogsResponse {
  return {
    query: '',
    range: { from: 2024, to: 2026 },
    bounds: { from: 2011, to: 2026 },
    total: 3,
    entries: [
      {
        id: 'h-whoz',
        type: 'experience',
        date: '2026-10-22',
        level: 'achievement',
        source: 'Whoz',
        message: 'Generate 95% of code with Claude.',
        labels: { type: 'experience', level: 'achievement', company: 'Whoz', role: 'Engineer' },
        tech: ['Claude'],
      },
      {
        id: 'h-kx',
        type: 'experience',
        date: '2025-11-30',
        level: 'milestone',
        source: 'KX',
        message: 'Introduced NX.',
        labels: {
          type: 'experience',
          level: 'milestone',
          company: 'KX',
          role: 'Front-End Engineer',
          team: 'platform',
        },
        tech: ['Angular', 'NX'],
      },
      {
        id: 'ed-esil',
        type: 'education',
        date: '2024-06-30',
        level: 'milestone',
        source: 'ESIL',
        message: 'Graduated: Engineering degree',
        labels: {
          type: 'education',
          level: 'milestone',
          school: 'ESIL',
          degree: 'Engineering degree',
        },
        tech: [],
      },
    ],
    volume: [
      { year: 2024, total: 1, levels: { achievement: 0, info: 0, learning: 0, milestone: 1 } },
      { year: 2025, total: 1, levels: { achievement: 0, info: 0, learning: 0, milestone: 1 } },
      { year: 2026, total: 1, levels: { achievement: 1, info: 0, learning: 0, milestone: 0 } },
    ],
  };
}

export const LABELS_FIXTURE: LogLabel[] = [
  { name: 'type', values: ['education', 'experience'] },
  { name: 'level', values: ['achievement', 'milestone'] },
  { name: 'company', values: ['KX', 'Whoz'] },
  { name: 'tech', values: ['Angular', 'Claude', 'NX'] },
];
