import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { Skill } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { showError } from '../shared/form-utils';
import { EMPTY_SKILL, SkillModel, skillSchema, toSkillModel, toSkillRequest } from './skill-form';

@Component({
  selector: 'app-skill-edit-page',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './skill-edit-page.html',
})
export class SkillEditPage {
  private readonly api = inject(ContentApi).skills;
  private readonly model = signal<SkillModel>(EMPTY_SKILL);
  protected readonly page = editPage<Skill>(
    () => this.api.list(),
    (s) => this.model.set(toSkillModel(s)),
  );
  protected readonly form = form(this.model, skillSchema, {
    submission: {
      action: () => {
        const body = toSkillRequest(this.model());
        const { isNew, id } = this.page;
        return this.page.save(isNew ? this.api.create(body) : this.api.update(id, body));
      },
    },
  });
  private readonly all = rxResource({ stream: () => this.api.list() });
  protected readonly categories = computed(() => [
    ...new Set((this.all.hasValue() ? this.all.value() : []).map((s) => s.category)),
  ]);
  protected readonly levels = [1, 2, 3, 4, 5];
  protected readonly showError = showError;
}
