import type { Education, Experience, Project, Skill } from '@my-resume/api-models';
import { formatPeriod } from '../../shared/format/period';
import type { ListConfig } from './admin-list-page';

export const SKILLS_LIST: ListConfig<Skill> = {
  resource: 'skills',
  label: 'Skills',
  addLabel: 'Add skill',
  toItem: (s) => ({
    id: s.id,
    title: s.name,
    subtitle: s.level ? `${s.category} · level ${s.level}` : s.category,
  }),
};

export const EXPERIENCES_LIST: ListConfig<Experience> = {
  resource: 'experiences',
  label: 'Experience',
  addLabel: 'Add experience',
  toItem: (e) => ({
    id: e.id,
    title: e.company,
    subtitle: `${e.role} · ${formatPeriod(e.startDate, e.endDate)}`,
  }),
};

export const EDUCATION_LIST: ListConfig<Education> = {
  resource: 'education',
  label: 'Education',
  addLabel: 'Add education',
  toItem: (e) => ({
    id: e.id,
    title: e.school,
    subtitle: `${e.degree} · ${formatPeriod(e.startDate, e.endDate)}`,
  }),
};

export const PROJECTS_LIST: ListConfig<Project> = {
  resource: 'projects',
  label: 'Projects',
  addLabel: 'Add project',
  toItem: (p) => ({ id: p.id, title: p.title, subtitle: p.slug }),
};
