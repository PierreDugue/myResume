import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { CreateEducationRequest, Education } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { endOnOrAfterStart, showError, textOrNull } from '../shared/form-utils';

interface EducationModel {
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

const empty: EducationModel = {
  school: '',
  degree: '',
  field: '',
  location: '',
  startDate: '',
  endDate: '',
  description: '',
};

function toModel(e: Education): EducationModel {
  return {
    school: e.school,
    degree: e.degree,
    field: e.field ?? '',
    location: e.location ?? '',
    startDate: e.startDate,
    endDate: e.endDate ?? '',
    description: e.description ?? '',
  };
}

function toRequest(m: EducationModel): CreateEducationRequest {
  return {
    school: m.school.trim(),
    degree: m.degree.trim(),
    field: textOrNull(m.field),
    location: textOrNull(m.location),
    startDate: m.startDate,
    endDate: textOrNull(m.endDate),
    description: textOrNull(m.description),
  };
}

@Component({
  selector: 'app-education-edit-page',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './education-edit-page.html',
})
export class EducationEditPage {
  private readonly api = inject(ContentApi).education;
  private readonly model = signal<EducationModel>(empty);
  protected readonly page = editPage<Education>(
    () => this.api.list(),
    (e) => this.model.set(toModel(e)),
  );
  protected readonly form = form(
    this.model,
    (e) => {
      required(e.school, { message: 'School is required' });
      maxLength(e.school, 120, { message: 'Use at most 120 characters' });
      required(e.degree, { message: 'Degree is required' });
      maxLength(e.degree, 120, { message: 'Use at most 120 characters' });
      required(e.startDate, { message: 'Start date is required' });
      endOnOrAfterStart(e.startDate, e.endDate);
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
  protected readonly showError = showError;
}
