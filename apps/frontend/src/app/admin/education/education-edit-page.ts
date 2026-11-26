import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { Education } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { showError } from '../shared/form-utils';
import {
  EMPTY_EDUCATION,
  EducationModel,
  educationSchema,
  toEducationModel,
  toEducationRequest,
} from './education-form';

@Component({
  selector: 'app-education-edit-page',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './education-edit-page.html',
})
export class EducationEditPage {
  private readonly api = inject(ContentApi).education;
  private readonly model = signal<EducationModel>(EMPTY_EDUCATION);
  protected readonly page = editPage<Education>(
    () => this.api.list(),
    (e) => this.model.set(toEducationModel(e)),
  );
  protected readonly form = form(this.model, educationSchema, {
    submission: {
      action: () => {
        const body = toEducationRequest(this.model());
        const { isNew, id } = this.page;
        return this.page.save(isNew ? this.api.create(body) : this.api.update(id, body));
      },
    },
  });
  protected readonly showError = showError;
}
