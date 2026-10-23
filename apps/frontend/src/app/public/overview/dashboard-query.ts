import { ParamMap, Params } from '@angular/router';
import type { DashboardQuery } from '@my-resume/api-models';

/** The dashboard view (range and filters) as stored in the page URL. */
export function parseDashboardQuery(params: ParamMap): DashboardQuery {
  const query: DashboardQuery = {};
  const year = (key: 'from' | 'to') => {
    const value = params.get(key);
    if (value && /^\d{4}$/.test(value)) query[key] = Number(value);
  };
  year('from');
  year('to');
  const category = params.get('category');
  if (category) query.category = category;
  const skill = params.get('skill');
  if (skill) query.skill = skill;
  return query;
}

/** Query params for router.navigate: unset keys are null, so they leave the URL. */
export function toQueryParams(query: DashboardQuery): Params {
  return {
    from: query.from ?? null,
    to: query.to ?? null,
    category: query.category ?? null,
    skill: query.skill ?? null,
  };
}
