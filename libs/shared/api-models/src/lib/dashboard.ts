import type { HighlightLevel, Impact, IsoDate, PublicProfile, SkillLevel } from './content';

/** Query of `GET /api/dashboard` (all optional). */
export interface DashboardQuery {
  from?: number;
  to?: number;
  category?: string;
  /** Skill slug. */
  skill?: string;
}

export interface DashboardRange {
  from: number;
  to: number;
}

export interface DashboardFilters {
  minYear: number;
  maxYear: number;
  categories: string[];
  skills: { slug: string; name: string; category: string }[];
}

export type StatKey =
  | 'yearsInIt'
  | 'yearsOfAngular'
  | 'uptime'
  | 'jobs'
  | 'technologies'
  | 'achievements';

export interface StatValue {
  key: StatKey;
  label: string;
  value: number;
  /** Formatted value, e.g. "14+", "since 2011". */
  display: string;
  hint: string | null;
}

export interface CareerStatus {
  state: 'employed' | 'open-to-work';
  company: string | null;
  openToRelocation: boolean;
}

export interface ImpactItem {
  highlightId: string;
  company: string;
  date: IsoDate;
  message: string;
  impact: Impact;
}

export interface TimelineItem {
  id: string;
  kind: 'job' | 'education';
  label: string;
  sublabel: string | null;
  startDate: IsoDate;
  /** null = ongoing. */
  endDate: IsoDate | null;
}

export interface SkillUsageSeries {
  skillId: string;
  slug: string;
  name: string;
  category: string;
  /** Months of use per year of `SkillUsage.years` (0..12). */
  monthsPerYear: number[];
  /** Experience at the end of each year, all-time, in years (1 decimal). */
  cumulativeYears: number[];
  /** Years of use within the range (1 decimal). */
  totalYears: number;
}

export interface SkillUsage {
  years: number[];
  /** Skills used in the range, most used first. */
  series: SkillUsageSeries[];
}

export interface SkillTotalsGroup {
  category: string;
  skills: {
    skillId: string;
    slug: string;
    name: string;
    years: number;
    level: SkillLevel | null;
  }[];
}

export interface LogLine {
  id: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  company: string;
}

/** `GET /api/dashboard`: every panel of the Career Overview. */
export interface DashboardResponse {
  range: DashboardRange;
  applied: { category: string | null; skill: string | null };
  filters: DashboardFilters;
  profile: PublicProfile | null;
  status: CareerStatus;
  stats: StatValue[];
  impacts: ImpactItem[];
  timeline: TimelineItem[];
  skillUsage: SkillUsage;
  skillTotals: SkillTotalsGroup[];
  latestHighlights: LogLine[];
}
