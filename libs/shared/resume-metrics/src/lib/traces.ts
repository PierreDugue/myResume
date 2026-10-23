import type {
  Project,
  ResumeResponse,
  Skill,
  Trace,
  TraceSpan,
  TraceSpanSkill,
  TraceSummary,
} from '@my-resume/api-models';

/**
 * One trace per project (see docs/api-contract.md, Traces): the root span is the project, the
 * others its spans, each placed on the root's time axis. Null for an unknown slug or a project
 * without a start date and without spans.
 */
export function buildTrace(resume: ResumeResponse, slug: string, today: string): Trace | null {
  const project = resume.projects.find((p) => p.slug === slug);
  const spans = project ? traceSpans(project, resume.skills, today) : null;
  if (!project || !spans) return null;
  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    url: project.url,
    repoUrl: project.repoUrl,
    spans,
  };
}

/** The trace search: every project that is a trace, in projects order. */
export function buildTraces(resume: ResumeResponse, today: string): TraceSummary[] {
  return resume.projects.flatMap((project) => {
    const spans = traceSpans(project, resume.skills, today);
    if (!spans) return [];
    const [root] = spans;
    const used = new Set([...project.skillIds, ...project.spans.flatMap((s) => s.skillIds)]);
    return [
      {
        slug: project.slug,
        title: project.title,
        startDate: root.startDate,
        endDate: root.endDate,
        ongoing: root.ongoing,
        durationDays: root.durationDays,
        spanCount: spans.length - 1,
        tech: resume.skills.filter((s) => used.has(s.id)).map((s) => s.name),
      },
    ];
  });
}

function traceSpans(project: Project, skills: Skill[], today: string): TraceSpan[] | null {
  const spans = [...project.spans].sort((a, b) => a.sortOrder - b.sortOrder);
  const start = project.startDate ?? minDate(spans.map((s) => s.startDate));
  if (!start) return null;

  // An ongoing span (or project) runs until today, or its own start if that is later.
  const spanEnd = (s: { startDate: string; endDate: string | null }) =>
    s.endDate ?? maxDate([today, s.startDate]);
  const end = project.endDate ?? maxDate([today, start, ...spans.map(spanEnd)]);
  const rootStart = dayIndex(start);
  const rootDays = dayIndex(end) - rootStart + 1;
  const tech = (ids: string[]): TraceSpanSkill[] =>
    skills.filter((s) => ids.includes(s.id)).map((s) => ({ slug: s.slug, name: s.name }));
  const place = (from: string, to: string) => ({
    durationDays: dayIndex(to) - dayIndex(from) + 1,
    offset: round((dayIndex(from) - rootStart) / rootDays),
    width: round((dayIndex(to) - dayIndex(from) + 1) / rootDays),
  });

  const root: TraceSpan = {
    id: project.id,
    parentId: null,
    depth: 0,
    name: project.title,
    startDate: start,
    endDate: end,
    ongoing: project.endDate === null,
    ...place(start, end),
    note: project.description,
    tech: tech(project.skillIds),
  };
  return [
    root,
    ...spans.map((s) => ({
      id: s.id,
      parentId: s.parentId ?? project.id,
      depth: s.depth + 1,
      name: s.name,
      startDate: s.startDate,
      endDate: spanEnd(s),
      ongoing: s.endDate === null,
      ...place(s.startDate, spanEnd(s)),
      note: s.note,
      tech: tech(s.skillIds),
    })),
  ];
}

/** Days since 1970-01-01 for a `YYYY-MM-DD` date (UTC, so no time zone can shift it). */
function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function minDate(dates: string[]): string | null {
  return dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : null;
}

function maxDate(dates: string[]): string {
  return dates.reduce((a, b) => (b > a ? b : a));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
