import type { ExploreSuggestion, IsoDate, ResumeResponse } from '@my-resume/api-models';
import { QueryParseError } from '@my-resume/query-parser';
import { buildLogs, DashboardQueryError } from '@my-resume/resume-metrics';

/**
 * The model's Explore query, checked like a visitor's query: kept only when it parses and
 * matches at least one line over the default range.
 */
export function toExploreSuggestion(input: {
  query: string | null;
  resume: ResumeResponse;
  today: IsoDate;
}): ExploreSuggestion | null {
  const { query, resume, today } = input;
  if (query === null) return null;
  try {
    const { total } = buildLogs({ resume, today, query: { query } });
    return total > 0 ? { query, matches: total } : null;
  } catch (error) {
    if (error instanceof QueryParseError || error instanceof DashboardQueryError) return null;
    throw error;
  }
}
