import { maxLength, required, schema } from '@angular/forms/signals';
import type { CreateSkillRequest, Skill, SkillLevel } from '@my-resume/api-models';
import { numberOrNull } from '../shared/form-utils';

/** The skill form model, shared by the skill screen and the in-place resume editor. */
export interface SkillModel {
  name: string;
  category: string;
  /** '' = no level; the select gives strings. */
  level: string;
}

export const EMPTY_SKILL: SkillModel = { name: '', category: '', level: '' };

export function toSkillModel(s: Skill): SkillModel {
  return { name: s.name, category: s.category, level: s.level ? String(s.level) : '' };
}

export function toSkillRequest(m: SkillModel): CreateSkillRequest {
  return {
    name: m.name.trim(),
    category: m.category.trim(),
    level: numberOrNull(m.level) as SkillLevel | null,
  };
}

export const skillSchema = schema<SkillModel>((s) => {
  required(s.name, { message: 'Name is required' });
  maxLength(s.name, 120, { message: 'Use at most 120 characters' });
  required(s.category, { message: 'Category is required' });
  maxLength(s.category, 60, { message: 'Use at most 60 characters' });
});
