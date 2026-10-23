import type {
  DashboardQuery,
  DashboardResponse,
  Experience,
  ImpactItem,
  LogLine,
  ResumeResponse,
  Skill,
  SkillTotalsGroup,
  SkillUsageSeries,
  StatValue,
  TimelineItem,
} from '@my-resume/api-models';
import { monthIndex, monthsBetween, toYears, yearOfMonth } from './months';

/** An invalid dashboard query (the API answers 400). */
export class DashboardQueryError extends Error {}

export interface DashboardInput {
  resume: ResumeResponse;
  /** `YYYY-MM-DD`: "now" for current jobs and the default range. */
  today: string;
  query: DashboardQuery;
}

const MIN_YEAR = 1950;
const MAX_YEAR = 2100;
const LATEST_HIGHLIGHTS = 5;

/** Calculates every panel of the Career Overview (see docs/api-contract.md, Dashboard). */
export function buildDashboard({ resume, today, query }: DashboardInput): DashboardResponse {
  const currentYear = Number(today.slice(0, 4));
  const firstJobYear = minYear(resume.experiences.map((e) => e.startDate)) ?? currentYear;
  const range = resolveRange(query, firstJobYear, currentYear);
  const skill = resolveSkill(resume.skills, query.skill);
  const category = resolveCategory(resume.skills, query.category);

  const inRange = (month: number) => {
    const year = yearOfMonth(month);
    return year >= range.from && year <= range.to;
  };
  const overlapsRange = (start: string, end: string | null) =>
    monthsBetween(start, end, today).some(inRange);
  const dateInRange = (date: string) => inRange(monthIndex(date));

  // Jobs and projects, narrowed to the selected skill.
  const experiences = resume.experiences.filter((e) => !skill || e.skillIds.includes(skill.id));
  const projects = resume.projects.filter(
    (p) => p.startDate !== null && (!skill || p.skillIds.includes(skill.id)),
  );

  // Months of use per skill (a Set, so overlapping jobs count once).
  const monthsBySkill = new Map<string, Set<number>>();
  const addUse = (skillIds: string[], start: string, end: string | null) => {
    const months = monthsBetween(start, end, today);
    for (const id of skillIds) {
      const set = monthsBySkill.get(id) ?? new Set<number>();
      months.forEach((m) => set.add(m));
      monthsBySkill.set(id, set);
    }
  };
  experiences.forEach((e) => addUse(e.skillIds, e.startDate, e.endDate));
  projects.forEach((p) => addUse(p.skillIds, p.startDate as string, p.endDate));

  const visibleSkills = resume.skills.filter(
    (s) => (!skill || s.id === skill.id) && (!category || s.category === category),
  );
  const years = Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i);

  const series: SkillUsageSeries[] = visibleSkills
    .map((s) => {
      const months = monthsBySkill.get(s.id) ?? new Set<number>();
      const sorted = [...months].sort((a, b) => a - b);
      const monthsPerYear = years.map((y) => sorted.filter((m) => yearOfMonth(m) === y).length);
      const cumulativeYears = years.map((y) =>
        toYears(sorted.filter((m) => yearOfMonth(m) <= y).length),
      );
      const inRangeMonths = monthsPerYear.reduce((a, b) => a + b, 0);
      return { s, monthsPerYear, cumulativeYears, inRangeMonths };
    })
    .filter((x) => x.inRangeMonths > 0)
    .sort((a, b) => b.inRangeMonths - a.inRangeMonths || a.s.sortOrder - b.s.sortOrder)
    .map(({ s, monthsPerYear, cumulativeYears, inRangeMonths }) => ({
      skillId: s.id,
      slug: s.slug,
      name: s.name,
      category: s.category,
      monthsPerYear,
      cumulativeYears,
      totalYears: toYears(inRangeMonths),
    }));

  const experiencesInRange = experiences.filter((e) => overlapsRange(e.startDate, e.endDate));
  const highlights = experiences
    .flatMap((e) => e.highlights.map((h) => ({ h, e })))
    .filter(({ h }) => dateInRange(h.date))
    .sort((a, b) => b.h.date.localeCompare(a.h.date));

  const current = resume.experiences.find((e) => e.endDate === null) ?? null;

  return {
    range,
    applied: { category, skill: skill?.slug ?? null },
    filters: {
      minYear:
        minYear([
          ...resume.experiences.map((e) => e.startDate),
          ...resume.education.map((e) => e.startDate),
          ...resume.projects.flatMap((p) => (p.startDate ? [p.startDate] : [])),
        ]) ?? currentYear,
      maxYear: currentYear,
      categories: [...new Set(resume.skills.map((s) => s.category))],
      skills: resume.skills.map((s) => ({ slug: s.slug, name: s.name, category: s.category })),
    },
    profile: resume.profile,
    status: {
      state: current ? 'employed' : 'open-to-work',
      company: current?.company ?? null,
      openToRelocation: resume.profile?.openToRelocation ?? false,
    },
    stats: buildStats({
      yearsInIt: resume.profile?.yearsInIt ?? null,
      yearsOfAngular: resume.profile?.yearsOfAngular ?? null,
      firstJobYear: resume.experiences.length ? firstJobYear : null,
      currentYear,
      jobs: experiencesInRange.length,
      technologies: series.length,
      achievements: highlights.length,
    }),
    impacts: highlights
      .filter(({ h }) => h.impact !== null)
      .map(
        ({ h, e }): ImpactItem => ({
          highlightId: h.id,
          company: e.company,
          date: h.date,
          message: h.message,
          impact: h.impact as NonNullable<typeof h.impact>,
        }),
      ),
    timeline: buildTimeline(resume, experiences, overlapsRange),
    skillUsage: { years, series },
    skillTotals: groupTotals(series, resume.skills),
    latestHighlights: highlights.slice(0, LATEST_HIGHLIGHTS).map(
      ({ h, e }): LogLine => ({
        id: h.id,
        date: h.date,
        level: h.level,
        message: h.message,
        company: e.company,
      }),
    ),
  };
}

/** The year range of a query, with defaults; throws a DashboardQueryError if invalid. */
export function resolveRange(query: DashboardQuery, defaultFrom: number, currentYear: number) {
  const from = query.from ?? defaultFrom;
  const to = query.to ?? currentYear;
  for (const [name, year] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
      throw new DashboardQueryError(`${name} must be a year between ${MIN_YEAR} and ${MAX_YEAR}`);
    }
  }
  if (from > to) throw new DashboardQueryError('from must not be after to');
  return { from, to };
}

function resolveSkill(skills: Skill[], slug: string | undefined): Skill | null {
  if (slug === undefined) return null;
  const skill = skills.find((s) => s.slug === slug);
  if (!skill) throw new DashboardQueryError(`Unknown skill "${slug}"`);
  return skill;
}

function resolveCategory(skills: Skill[], category: string | undefined): string | null {
  if (category === undefined) return null;
  if (!skills.some((s) => s.category === category)) {
    throw new DashboardQueryError(`Unknown category "${category}"`);
  }
  return category;
}

function minYear(dates: string[]): number | null {
  return dates.length ? Math.min(...dates.map((d) => Number(d.slice(0, 4)))) : null;
}

function buildStats(v: {
  yearsInIt: number | null;
  yearsOfAngular: number | null;
  firstJobYear: number | null;
  currentYear: number;
  jobs: number;
  technologies: number;
  achievements: number;
}): StatValue[] {
  const headline = (n: number | null) => (n === null ? '–' : `${n}+`);
  const years = v.firstJobYear === null ? null : v.currentYear - v.firstJobYear;
  return [
    {
      key: 'yearsInIt',
      label: 'Years in IT',
      value: v.yearsInIt ?? 0,
      display: headline(v.yearsInIt),
      hint: null,
    },
    {
      key: 'yearsOfAngular',
      label: 'Years of Angular',
      value: v.yearsOfAngular ?? 0,
      display: headline(v.yearsOfAngular),
      hint: null,
    },
    {
      key: 'uptime',
      label: 'Uptime',
      value: v.firstJobYear ?? 0,
      display: v.firstJobYear === null ? '–' : `since ${v.firstJobYear}`,
      hint: years === null ? null : `${years} years`,
    },
    { key: 'jobs', label: 'Jobs', value: v.jobs, display: String(v.jobs), hint: null },
    {
      key: 'technologies',
      label: 'Technologies',
      value: v.technologies,
      display: String(v.technologies),
      hint: null,
    },
    {
      key: 'achievements',
      label: 'Achievements',
      value: v.achievements,
      display: String(v.achievements),
      hint: null,
    },
  ];
}

function buildTimeline(
  resume: ResumeResponse,
  experiences: Experience[],
  overlapsRange: (start: string, end: string | null) => boolean,
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...resume.education.map(
      (e): TimelineItem => ({
        id: e.id,
        kind: 'education',
        label: e.school,
        sublabel: e.degree,
        startDate: e.startDate,
        endDate: e.endDate,
      }),
    ),
    ...experiences.map(
      (e): TimelineItem => ({
        id: e.id,
        kind: 'job',
        label: e.company,
        sublabel: e.role,
        startDate: e.startDate,
        endDate: e.endDate,
      }),
    ),
  ];
  return items
    .filter((i) => overlapsRange(i.startDate, i.endDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function groupTotals(series: SkillUsageSeries[], skills: Skill[]): SkillTotalsGroup[] {
  const level = new Map(skills.map((s) => [s.id, s.level]));
  const order = [...new Set(skills.map((s) => s.category))];
  return order
    .map((category) => ({
      category,
      skills: series
        .filter((s) => s.category === category)
        .map((s) => ({
          skillId: s.skillId,
          slug: s.slug,
          name: s.name,
          years: s.totalYears,
          level: level.get(s.skillId) ?? null,
        })),
    }))
    .filter((g) => g.skills.length > 0);
}
