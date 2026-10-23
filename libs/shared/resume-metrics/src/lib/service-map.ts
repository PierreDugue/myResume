import type {
  ResumeResponse,
  ServiceMapEdge,
  ServiceMapNode,
  ServiceMapResponse,
} from '@my-resume/api-models';
import { monthsBetween, toYears } from './months';

/**
 * The service map (see docs/api-contract.md, Service map): jobs and dated projects linked to the
 * skills they used. A skill's size is its years of use, counted like the dashboard (months of the
 * jobs and projects linked to it, overlaps once); a job's or project's size is its duration.
 */
export function buildServiceMap(resume: ResumeResponse, today: string): ServiceMapResponse {
  const projects = resume.projects.filter((p) => p.startDate !== null);
  const monthsBySkill = new Map<string, Set<number>>();
  const addUse = (skillIds: string[], months: number[]) => {
    for (const id of skillIds) {
      const set = monthsBySkill.get(id) ?? new Set<number>();
      months.forEach((m) => set.add(m));
      monthsBySkill.set(id, set);
    }
  };

  const nodes: ServiceMapNode[] = [];
  const edges: ServiceMapEdge[] = [];
  const linked = new Set<string>();
  const skillOrder = new Map(resume.skills.map((s, i) => [s.id, i]));
  const link = (source: string, skillIds: string[]) => {
    const ids = [...new Set(skillIds)]
      .filter((id) => skillOrder.has(id))
      .sort((a, b) => (skillOrder.get(a) ?? 0) - (skillOrder.get(b) ?? 0));
    for (const id of ids) {
      edges.push({ source, target: `skill:${id}` });
      linked.add(id);
    }
  };

  for (const job of resume.experiences) {
    const months = monthsBetween(job.startDate, job.endDate, today);
    addUse(job.skillIds, months);
    const id = `job:${job.id}`;
    nodes.push({
      id,
      kind: 'job',
      label: job.company,
      years: toYears(months.length),
      slug: null,
      category: null,
    });
    link(id, job.skillIds);
  }
  for (const project of projects) {
    const months = monthsBetween(project.startDate as string, project.endDate, today);
    addUse(project.skillIds, months);
    const id = `project:${project.id}`;
    nodes.push({
      id,
      kind: 'project',
      label: project.title,
      years: toYears(months.length),
      slug: project.slug,
      category: null,
    });
    link(id, [...project.skillIds, ...project.spans.flatMap((s) => s.skillIds)]);
  }
  for (const skill of resume.skills) {
    if (!linked.has(skill.id)) continue;
    nodes.push({
      id: `skill:${skill.id}`,
      kind: 'skill',
      label: skill.name,
      years: toYears(monthsBySkill.get(skill.id)?.size ?? 0),
      slug: skill.slug,
      category: skill.category,
    });
  }
  return { nodes, edges };
}
