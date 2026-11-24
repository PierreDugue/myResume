import type {
  Education,
  Experience,
  IsoDate,
  Project,
  PublicProfile,
  ResumeResponse,
  Skill,
} from '@my-resume/api-models';

/**
 * The public resume as compact, line-oriented text for the assistant's prompt. Built only from
 * `ResumeResponse` (what any visitor can already see). Writes no id and leaves out null fields.
 * `today` dates the text, so "how long" questions can be answered.
 */
export function buildResumeContext(resume: ResumeResponse, today: IsoDate): string {
  const skillName = new Map(resume.skills.map((s) => [s.id, s.name]));
  const names = (ids: string[]) =>
    ids.map((id) => skillName.get(id)).filter((name): name is string => name !== undefined);

  const sections = [
    `TODAY ${today}`,
    resume.profile ? profileLines(resume.profile) : [],
    section('EXPERIENCE', resume.experiences, (job) => experienceLines(job, names)),
    section('PROJECTS', resume.projects, (project) => projectLines(project, names)),
    section('EDUCATION', resume.education, educationLines),
    skillsLines(resume.skills),
  ];
  return sections
    .flat()
    .filter((line) => line !== '')
    .join('\n');
}

function profileLines(p: PublicProfile): string[] {
  return [
    'PROFILE',
    field('Name', p.fullName),
    field('Headline', p.headline),
    field('Summary', p.summary),
    field('Location', p.location),
    field('Open to relocation', p.openToRelocation ? 'yes' : 'no'),
    field('Email', p.email),
    ...p.links.map((link) => field(`Link ${link.label}`, link.url)),
    field('Interests', p.interests),
    field('Years in IT', p.yearsInIt),
    field('Years of Angular', p.yearsOfAngular),
  ];
}

function experienceLines(job: Experience, names: (ids: string[]) => string[]): string[] {
  const highlights = [...job.highlights].sort((a, b) => a.sortOrder - b.sortOrder);
  return [
    `- ${job.role} at ${job.company}, ${period(job.startDate, job.endDate, 'present (current job)')}`,
    field('  Location', job.location),
    field('  Summary', job.summary),
    field('  Technologies', names(job.skillIds).join(', ')),
    ...highlights.map((h) => {
      const tech = names(h.skillIds);
      const labels = Object.entries(h.labels ?? {}).map(([k, v]) => `${k}=${v}`);
      const extra = [...(tech.length ? [`tech: ${tech.join(', ')}`] : []), ...labels];
      return `  * ${h.date} [${h.level}] ${h.message}${extra.length ? ` (${extra.join('; ')})` : ''}`;
    }),
  ];
}

function projectLines(project: Project, names: (ids: string[]) => string[]): string[] {
  const when = project.startDate
    ? `, ${period(project.startDate, project.endDate, 'ongoing')}`
    : '';
  return [
    `- ${project.title}${when}`,
    field('  Description', project.description),
    field('  Technologies', names(project.skillIds).join(', ')),
    field('  URL', project.url),
    field('  Repository', project.repoUrl),
    ...[...project.spans]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((span) => {
        const indent = '  '.repeat(span.depth + 1);
        const note = span.note ? `: ${span.note}` : '';
        return `${indent}> ${span.name}, ${period(span.startDate, span.endDate, 'ongoing')}${note}`;
      }),
  ];
}

function educationLines(ed: Education): string[] {
  const what = ed.field ? `${ed.degree}, ${ed.field}` : ed.degree;
  return [
    `- ${what} at ${ed.school}, ${period(ed.startDate, ed.endDate, 'ongoing')}`,
    field('  Location', ed.location),
    field('  Description', ed.description),
  ];
}

function skillsLines(skills: Skill[]): string[] {
  if (skills.length === 0) return [];
  const byCategory = new Map<string, string[]>();
  for (const skill of skills) {
    byCategory.set(skill.category, [...(byCategory.get(skill.category) ?? []), skill.name]);
  }
  return [
    'SKILLS',
    ...[...byCategory].map(([category, list]) => `- ${category}: ${list.join(', ')}`),
  ];
}

function section<T>(title: string, items: T[], lines: (item: T) => string[]): string[] {
  return items.length === 0 ? [] : [title, ...items.flatMap(lines)];
}

/** `Label: value`, or '' (dropped) when the value is null or empty. */
function field(label: string, value: string | number | null): string {
  return value === null || value === '' ? '' : `${label}: ${value}`;
}

function period(start: IsoDate, end: IsoDate | null, open: string): string {
  return `${start} to ${end ?? open}`;
}
