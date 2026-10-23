import type {
  HighlightLevel,
  LogEntry,
  LogLabel,
  LogsQuery,
  LogsResponse,
  LogVolume,
  ResumeResponse,
} from '@my-resume/api-models';
import { compileQuery, parseQuery } from '@my-resume/query-parser';
import { resolveRange } from './dashboard';

export interface LogsInput {
  resume: ResumeResponse;
  /** `YYYY-MM-DD`: the default range ends this year. */
  today: string;
  query: LogsQuery;
}

const LEVELS: HighlightLevel[] = ['achievement', 'info', 'learning', 'milestone'];
/** Labels set from the content: a highlight's own labels can't use these keys. */
export const RESERVED_LABELS: readonly string[] = [
  'type',
  'level',
  'company',
  'role',
  'location',
  'school',
  'degree',
  'project',
  'tech',
];
const RESERVED = new Set(RESERVED_LABELS);

/**
 * The resume as a log stream, filtered by a LogQL-style query and a year range (see
 * docs/api-contract.md, Explore). Throws a `QueryParseError` for an invalid query and a
 * `DashboardQueryError` for an invalid range.
 */
export function buildLogs({ resume, today, query }: LogsInput): LogsResponse {
  const text = query.query ?? '';
  const matches = compileQuery(parseQuery(text));
  const all = logEntries(resume);
  const currentYear = Number(today.slice(0, 4));
  const oldest = Math.min(currentYear, ...all.map((e) => yearOf(e.date)));
  const range = resolveRange(query, oldest, currentYear);

  const entries = all.filter((e) => {
    const year = yearOf(e.date);
    return (
      year >= range.from &&
      year <= range.to &&
      matches({ labels: e.labels, tech: e.tech, line: `${e.source} ${e.message}` })
    );
  });

  const volume: LogVolume[] = [];
  for (let year = range.from; year <= range.to; year++) {
    const levels = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<HighlightLevel, number>;
    const inYear = entries.filter((e) => yearOf(e.date) === year);
    inYear.forEach((e) => levels[e.level]++);
    volume.push({ year, total: inYear.length, levels });
  }

  const bounds = { from: oldest, to: currentYear };
  return { query: text, range, bounds, total: entries.length, entries, volume };
}

/** Every label used by a log line, `type` and `level` first, then by name; values sorted. */
export function logLabels(resume: ResumeResponse): LogLabel[] {
  const values = new Map<string, Set<string>>();
  const add = (name: string, value: string) =>
    values.set(name, (values.get(name) ?? new Set()).add(value));
  for (const entry of logEntries(resume)) {
    Object.entries(entry.labels).forEach(([name, value]) => add(name, value));
    entry.tech.forEach((name) => add('tech', name));
  }
  const rank = (name: string) => ['type', 'level'].indexOf(name) + 1 || 3;
  return [...values]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, set]) => ({ name, values: [...set].sort((a, b) => a.localeCompare(b)) }));
}

/** All log lines, newest first (lines of the same day keep the resume's order). */
function logEntries(resume: ResumeResponse): LogEntry[] {
  const skillOrder = new Map(resume.skills.map((s, i) => [s.id, i]));
  const skillName = new Map(resume.skills.map((s) => [s.id, s.name]));
  const tech = (ids: string[]) =>
    ids
      .filter((id) => skillName.has(id))
      .sort((a, b) => (skillOrder.get(a) ?? 0) - (skillOrder.get(b) ?? 0))
      .map((id) => skillName.get(id) as string);

  const entries: LogEntry[] = [];
  for (const job of resume.experiences) {
    for (const h of [...job.highlights].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const own = Object.entries(h.labels ?? {}).filter(([key]) => !RESERVED.has(key));
      entries.push({
        id: h.id,
        type: 'experience',
        date: h.date,
        level: h.level,
        source: job.company,
        message: h.message,
        labels: {
          type: 'experience',
          level: h.level,
          company: job.company,
          role: job.role,
          ...(job.location && { location: job.location }),
          ...Object.fromEntries(own),
        },
        tech: tech(h.skillIds ?? []),
      });
    }
  }
  for (const ed of resume.education) {
    const what = ed.field ? `${ed.degree}, ${ed.field}` : ed.degree;
    entries.push({
      id: ed.id,
      type: 'education',
      date: ed.endDate ?? ed.startDate,
      level: 'milestone',
      source: ed.school,
      message: `${ed.endDate ? 'Graduated' : 'Started'}: ${what}`,
      labels: {
        type: 'education',
        level: 'milestone',
        school: ed.school,
        degree: ed.degree,
        ...(ed.location && { location: ed.location }),
      },
      tech: [],
    });
  }
  for (const p of resume.projects) {
    if (!p.startDate) continue;
    entries.push({
      id: p.id,
      type: 'project',
      date: p.startDate,
      level: 'milestone',
      source: p.title,
      message: `${p.title}: ${p.description}`,
      labels: { type: 'project', level: 'milestone', project: p.slug },
      tech: tech(p.skillIds),
    });
  }
  // Array.prototype.sort is stable, so same-day lines keep the order above.
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}
