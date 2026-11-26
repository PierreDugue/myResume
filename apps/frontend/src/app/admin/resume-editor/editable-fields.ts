import { Injector, signal } from '@angular/core';
import { FieldTree, Schema, form } from '@angular/forms/signals';
import { Observable } from 'rxjs';
import type {
  ResumeFieldRef,
  ResumeSectionKind,
} from '../../public/plain-resume/resume-edit-slots';
import { toExperienceModel, toHighlightInput } from '../experiences/experience-form';
import { ProfileModel, profileSchema, toProfile, toProfileModel } from '../profile/profile-form';
import { ITEM_MODELS, ModelOf } from './item-models';
import { ResumeEditorStore, UpdateOf } from './resume-editor.store';

/** How a text of the plain view is presented when edited. */
export interface FieldInfo {
  label: string;
  /** A text area (Ctrl/Cmd+Enter saves) instead of a one-line input. */
  multiline: boolean;
}

const PROFILE: Record<Extract<ResumeFieldRef, { kind: 'profile' }>['field'], FieldInfo> = {
  fullName: { label: 'Full name', multiline: false },
  headline: { label: 'Headline', multiline: false },
  email: { label: 'Email', multiline: false },
  phone: { label: 'Phone', multiline: false },
  location: { label: 'Location', multiline: false },
  summary: { label: 'Summary', multiline: true },
  interests: { label: 'Interests', multiline: true },
};
const EXPERIENCE: Record<Extract<ResumeFieldRef, { kind: 'experience' }>['field'], FieldInfo> = {
  role: { label: 'Role', multiline: false },
  company: { label: 'Company', multiline: false },
  location: { label: 'Location', multiline: false },
  summary: { label: 'Summary', multiline: true },
};
const PROJECT: Record<Extract<ResumeFieldRef, { kind: 'project' }>['field'], FieldInfo> = {
  title: { label: 'Title', multiline: false },
  description: { label: 'Description', multiline: true },
};
const EDUCATION: Record<Extract<ResumeFieldRef, { kind: 'education' }>['field'], FieldInfo> = {
  school: { label: 'School', multiline: false },
  degree: { label: 'Degree', multiline: false },
  field: { label: 'Field', multiline: false },
  location: { label: 'Location', multiline: false },
  description: { label: 'Description', multiline: true },
};

export function fieldInfo(ref: ResumeFieldRef): FieldInfo {
  switch (ref.kind) {
    case 'profile':
      return PROFILE[ref.field];
    case 'experience':
      return EXPERIENCE[ref.field];
    case 'highlight':
      return { label: 'Achievement', multiline: true };
    case 'project':
      return PROJECT[ref.field];
    case 'education':
      return EDUCATION[ref.field];
    case 'skill':
      return { label: 'Name', multiline: false };
  }
}

/**
 * An open field: the edited text in a form over the item's whole shared model (so the section
 * screen's rules apply), and how to save a value.
 */
export interface FieldSession {
  readonly field: FieldTree<string>;
  /** The text when the field opened. */
  readonly initial: string;
  /** Queues the value; the request is built at the write's turn, from the store's item then. */
  save(value: string): Observable<unknown>;
}

function session<M>(
  model: M,
  schema: Schema<M>,
  path: (tree: FieldTree<M>) => FieldTree<string>,
  injector: Injector,
  save: (value: string) => Observable<unknown>,
): FieldSession {
  const field = path(form(signal(model), schema, { injector }));
  return { field, initial: field().value(), save };
}

/** A string field of a model (every inline text is one). */
type TextKey<M> = { [P in keyof M]: M[P] extends string ? P : never }[keyof M] & string;

const textOf = <M>(tree: FieldTree<M>, key: TextKey<M>) =>
  (tree as unknown as Record<string, FieldTree<string>>)[key];

/** A text of an item: PATCH with that key only, mapped like its section screen. */
function itemField<K extends ResumeSectionKind>(
  store: ResumeEditorStore,
  kind: K,
  id: string,
  key: TextKey<ModelOf[K]>,
  injector: Injector,
): FieldSession | null {
  const models = ITEM_MODELS[kind];
  const entity = store.find(kind, id);
  if (!entity) return null;
  return session(
    models.toModel(entity),
    models.schema,
    (t) => textOf(t, key),
    injector,
    (value) =>
      store.update(kind, id, (current) => {
        const request = models.toRequest({ ...models.toModel(current), [key]: value }, current);
        // Only the edited key; each inline text's model key is also its request key.
        return { [key]: (request as unknown as Record<string, unknown>)[key] } as UpdateOf[K];
      }),
  );
}

/** Opens the field `ref` points to, or null when its item is gone. */
export function openField(
  ref: ResumeFieldRef,
  store: ResumeEditorStore,
  injector: Injector,
): FieldSession | null {
  switch (ref.kind) {
    case 'profile': {
      const profile = store.resume()?.profile;
      if (!profile) return null;
      const key = ref.field;
      return session<ProfileModel>(
        toProfileModel(profile),
        profileSchema,
        (t) => t[key],
        injector,
        (value) =>
          store.saveProfile((current) => toProfile({ ...toProfileModel(current), [key]: value })),
      );
    }
    case 'highlight': {
      const job = store.find('experience', ref.experienceId);
      const index = job?.highlights.findIndex((h) => h.id === ref.id) ?? -1;
      if (!job || index < 0) return null;
      const models = ITEM_MODELS.experience;
      return session(
        models.toModel(job),
        models.schema,
        (t) => t.highlights[index].message,
        injector,
        (value) =>
          store.update('experience', job.id, (current) => ({
            highlights: toExperienceModel(current)
              .highlights.map((h) => (h.id === ref.id ? { ...h, message: value } : h))
              .map(toHighlightInput),
          })),
      );
    }
    case 'skill':
      return itemField(store, 'skill', ref.id, ref.field, injector);
    case 'experience':
      return itemField(store, 'experience', ref.id, ref.field, injector);
    case 'education':
      return itemField(store, 'education', ref.id, ref.field, injector);
    case 'project':
      return itemField(store, 'project', ref.id, ref.field, injector);
  }
}
