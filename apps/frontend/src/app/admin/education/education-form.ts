import { maxLength, required, schema } from '@angular/forms/signals';
import type { CreateEducationRequest, Education } from '@my-resume/api-models';
import { endOnOrAfterStart, textOrNull } from '../shared/form-utils';

/** The education form model, shared by the education screen and the in-place resume editor. */
export interface EducationModel {
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export const EMPTY_EDUCATION: EducationModel = {
  school: '',
  degree: '',
  field: '',
  location: '',
  startDate: '',
  endDate: '',
  description: '',
};

export function toEducationModel(e: Education): EducationModel {
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

export function toEducationRequest(m: EducationModel): CreateEducationRequest {
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

export const educationSchema = schema<EducationModel>((e) => {
  required(e.school, { message: 'School is required' });
  maxLength(e.school, 120, { message: 'Use at most 120 characters' });
  required(e.degree, { message: 'Degree is required' });
  maxLength(e.degree, 120, { message: 'Use at most 120 characters' });
  required(e.startDate, { message: 'Start date is required' });
  endOnOrAfterStart(e.startDate, e.endDate);
});
