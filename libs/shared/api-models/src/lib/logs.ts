import type { HighlightLevel, IsoDate } from './content';
import type { DashboardRange } from './dashboard';

/** What a log line comes from (the `type` label). */
export type LogType = 'experience' | 'education' | 'project';

/** Query of `GET /api/logs` (all optional). */
export interface LogsQuery {
  /** LogQL-style query, e.g. `{company="Whoz"} |= "angular"`. */
  query?: string;
  from?: number;
  to?: number;
}

/** One log line: a highlight, an education entry or a project. */
export interface LogEntry {
  /** The highlight, education or project id. */
  id: string;
  type: LogType;
  date: IsoDate;
  level: HighlightLevel;
  /** Company, school or project title. */
  source: string;
  message: string;
  /** `type`, `level`, then company/role/location, school/degree/location or project, then own labels. */
  labels: Record<string, string>;
  /** Skill names, in skills-list order. */
  tech: string[];
}

/** Matching lines in one year, per level. */
export interface LogVolume {
  year: number;
  total: number;
  levels: Record<HighlightLevel, number>;
}

export interface LogsResponse {
  /** As received ('' when left out). */
  query: string;
  /** As applied (defaults filled in). */
  range: DashboardRange;
  /** The default range, for range pickers: year of the oldest line to the current year. */
  bounds: DashboardRange;
  /** Matching lines in the range. */
  total: number;
  /** Newest first. */
  entries: LogEntry[];
  /** One bucket per year of the range, oldest first. */
  volume: LogVolume[];
}

/** A label used by the log lines and its distinct values (`GET /api/logs/labels`). */
export interface LogLabel {
  name: string;
  values: string[];
}
