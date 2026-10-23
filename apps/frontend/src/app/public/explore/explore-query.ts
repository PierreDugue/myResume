import { ParamMap, Params } from '@angular/router';
import type { LogsQuery } from '@my-resume/api-models';

/** The Explore view (query and years) as stored in the page URL. */
export function parseExploreQuery(params: ParamMap): LogsQuery {
  const query: LogsQuery = {};
  const text = params.get('query');
  if (text) query.query = text;
  for (const key of ['from', 'to'] as const) {
    const value = params.get(key);
    if (value && /^\d{4}$/.test(value)) query[key] = Number(value);
  }
  return query;
}

/** Query params for router.navigate: unset keys are null, so they leave the URL. */
export function toExploreParams(query: LogsQuery): Params {
  return { query: query.query || null, from: query.from ?? null, to: query.to ?? null };
}
