import { InjectionToken, Type } from '@angular/core';

export type ResumeSectionKind = 'experience' | 'project' | 'education' | 'skill';

export type ResumeItemRef = { kind: 'profile' } | { kind: ResumeSectionKind; id: string };

export type ResumeFieldRef =
  | {
      kind: 'profile';
      field: 'fullName' | 'headline' | 'email' | 'phone' | 'location' | 'summary' | 'interests';
    }
  | { kind: 'experience'; id: string; field: 'role' | 'company' | 'location' | 'summary' }
  | { kind: 'highlight'; experienceId: string; id: string }
  | { kind: 'project'; id: string; field: 'title' | 'description' }
  | {
      kind: 'education';
      id: string;
      field: 'school' | 'degree' | 'field' | 'location' | 'description';
    }
  | { kind: 'skill'; id: string; field: 'name' };

/** Components the admin plugs into the plain view to edit it. */
export interface ResumeEditSlots {
  /** Inputs: `ref: ResumeFieldRef`, `value: string | null`. */
  field: Type<unknown>;
  /** Inputs: `item: ResumeItemRef`. */
  item: Type<unknown>;
  /** Inputs: `section: ResumeSectionKind`. */
  section: Type<unknown>;
}

export const RESUME_EDIT_SLOTS = new InjectionToken<ResumeEditSlots>('RESUME_EDIT_SLOTS');
