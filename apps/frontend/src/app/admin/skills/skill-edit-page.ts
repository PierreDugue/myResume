import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { CreateSkillRequest, Skill, SkillLevel } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { numberOrNull, showError } from '../shared/form-utils';

interface SkillModel {
  name: string;
  category: string;
  /** '' = no level; the select gives strings. */
  level: string;
}

function toRequest(m: SkillModel): CreateSkillRequest {
  return {
    name: m.name.trim(),
    category: m.category.trim(),
    level: numberOrNull(m.level) as SkillLevel | null,
  };
}

@Component({
  selector: 'app-skill-edit-page',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './skill-edit-page.html',
})
export class SkillEditPage {
  private readonly api = inject(ContentApi).skills;
  private readonly model = signal<SkillModel>({ name: '', category: '', level: '' });
  protected readonly page = editPage<Skill>(
    () => this.api.list(),
    (s) =>
      this.model.set({
        name: s.name,
        category: s.category,
        level: s.level ? String(s.level) : '',
      }),
  );
  protected readonly form = form(
    this.model,
    (s) => {
      required(s.name, { message: 'Name is required' });
      maxLength(s.name, 120, { message: 'Use at most 120 characters' });
      required(s.category, { message: 'Category is required' });
      maxLength(s.category, 60, { message: 'Use at most 60 characters' });
    },
    {
      submission: {
        action: () => {
          const body = toRequest(this.model());
          const { isNew, id } = this.page;
          return this.page.save(isNew ? this.api.create(body) : this.api.update(id, body));
        },
      },
    },
  );
  private readonly all = rxResource({ stream: () => this.api.list() });
  protected readonly categories = computed(() => [
    ...new Set((this.all.hasValue() ? this.all.value() : []).map((s) => s.category)),
  ]);
  protected readonly levels = [1, 2, 3, 4, 5];
  protected readonly showError = showError;
}
