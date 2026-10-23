import type { IsoDate } from './content';

export interface TraceSpanSkill {
  slug: string;
  name: string;
}

/** A span as drawn in the waterfall; the first span of a trace is the root (the project). */
export interface TraceSpan {
  /** The project id for the root. */
  id: string;
  /** null for the root; the root's id for depth-1 spans. */
  parentId: string | null;
  /** 0 = root, 1..4 = spans. */
  depth: number;
  name: string;
  startDate: IsoDate;
  /** As drawn: today for an ongoing span. */
  endDate: IsoDate;
  ongoing: boolean;
  /** Calendar days, both ends included. */
  durationDays: number;
  /** 0..1: where it starts on the root's time axis. */
  offset: number;
  /** 0..1: its length on the root's time axis. */
  width: number;
  /** The project description for the root. */
  note: string | null;
  /** In skills-list order; the project's skills for the root. */
  tech: TraceSpanSkill[];
}

/** `GET /api/traces/:slug`. */
export interface Trace {
  slug: string;
  title: string;
  description: string;
  url: string | null;
  repoUrl: string | null;
  /** The root first, then the outline order. */
  spans: TraceSpan[];
}

/** A row of the trace search (`GET /api/traces`). */
export interface TraceSummary {
  slug: string;
  title: string;
  startDate: IsoDate;
  /** As drawn: today for an ongoing project. */
  endDate: IsoDate;
  ongoing: boolean;
  durationDays: number;
  /** Without the root. */
  spanCount: number;
  /** Skill names of the project and its spans, in skills-list order. */
  tech: string[];
}
