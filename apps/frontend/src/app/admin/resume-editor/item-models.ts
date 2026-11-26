import type { Schema } from '@angular/forms/signals';
import type { ResumeSectionKind } from '../../public/plain-resume/resume-edit-slots';
import {
  EMPTY_EDUCATION,
  EducationModel,
  educationSchema,
  toEducationModel,
  toEducationRequest,
} from '../education/education-form';
import {
  EMPTY_EXPERIENCE,
  ExperienceModel,
  experienceSchema,
  toExperienceModel,
  toExperienceRequest,
} from '../experiences/experience-form';
import { EDUCATION_LIST, EXPERIENCES_LIST, PROJECTS_LIST, SKILLS_LIST } from '../list/list-configs';
import {
  EMPTY_PROJECT,
  ProjectModel,
  projectSchema,
  toProjectModel,
  toProjectRequest,
} from '../projects/project-form';
import {
  EMPTY_SKILL,
  SkillModel,
  skillSchema,
  toSkillModel,
  toSkillRequest,
} from '../skills/skill-form';
import type { CreateOf, EntityOf } from './resume-editor.store';

export interface ModelOf {
  experience: ExperienceModel;
  education: EducationModel;
  project: ProjectModel;
  skill: SkillModel;
}

/** How an item kind maps to the shared form model of its section screen (no second copy). */
export interface ItemModel<K extends ResumeSectionKind> {
  empty: ModelOf[K];
  schema: Schema<ModelOf[K]>;
  toModel(entity: EntityOf[K]): ModelOf[K];
  /** The request for `model`; `entity` (when it exists) supplies what the model doesn't hold. */
  toRequest(model: ModelOf[K], entity?: EntityOf[K]): CreateOf[K];
  /** The item's name in buttons and confirmations, as in the section lists. */
  title(entity: EntityOf[K]): string;
  /** Its full form in the section screens. */
  path: string;
}

export const ITEM_MODELS: { [K in ResumeSectionKind]: ItemModel<K> } = {
  experience: {
    empty: EMPTY_EXPERIENCE,
    schema: experienceSchema,
    toModel: toExperienceModel,
    toRequest: (m, e) => toExperienceRequest(m, e?.skillIds ?? []),
    title: (e) => EXPERIENCES_LIST.toItem(e).title,
    path: '/admin/experiences',
  },
  education: {
    empty: EMPTY_EDUCATION,
    schema: educationSchema,
    toModel: toEducationModel,
    toRequest: (m) => toEducationRequest(m),
    title: (e) => EDUCATION_LIST.toItem(e).title,
    path: '/admin/education',
  },
  project: {
    empty: EMPTY_PROJECT,
    schema: projectSchema,
    toModel: toProjectModel,
    toRequest: (m, p) => toProjectRequest(m, p?.skillIds ?? []),
    title: (p) => PROJECTS_LIST.toItem(p).title,
    path: '/admin/projects',
  },
  skill: {
    empty: EMPTY_SKILL,
    schema: skillSchema,
    toModel: toSkillModel,
    toRequest: (m) => toSkillRequest(m),
    title: (s) => SKILLS_LIST.toItem(s).title,
    path: '/admin/skills',
  },
};
