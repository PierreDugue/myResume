import { applyEach, maxLength, pattern, required, schema, validate } from '@angular/forms/signals';
import type {
  CreateProjectRequest,
  Project,
  ProjectSpan,
  ProjectSpanInput,
} from '@my-resume/api-models';
import { spanOutlineErrors } from '@my-resume/resume-metrics';
import { endOnOrAfterStart, httpUrl, textOrNull } from '../shared/form-utils';

/** The project form model, shared by the project screen and the in-place resume editor. */
export interface SpanModel {
  /** '' for a new span. */
  id: string;
  depth: number;
  name: string;
  startDate: string;
  /** '' = ongoing. */
  endDate: string;
  note: string;
  skillIds: string[];
}

export interface ProjectModel {
  title: string;
  slug: string;
  description: string;
  url: string;
  repoUrl: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  spans: SpanModel[];
}

export const EMPTY_PROJECT: ProjectModel = {
  title: '',
  slug: '',
  description: '',
  url: '',
  repoUrl: '',
  imageUrl: '',
  startDate: '',
  endDate: '',
  spans: [],
};

export function toSpanModel(s?: ProjectSpan): SpanModel {
  return {
    id: s?.id ?? '',
    depth: s?.depth ?? 0,
    name: s?.name ?? '',
    startDate: s?.startDate ?? '',
    endDate: s?.endDate ?? '',
    note: s?.note ?? '',
    skillIds: [...(s?.skillIds ?? [])],
  };
}

function toSpanInput(s: SpanModel): ProjectSpanInput {
  return {
    ...(s.id && { id: s.id }),
    depth: s.depth,
    name: s.name.trim(),
    startDate: s.startDate,
    endDate: textOrNull(s.endDate),
    note: textOrNull(s.note),
    skillIds: s.skillIds,
  };
}

export function toProjectModel(p: Project): ProjectModel {
  return {
    title: p.title,
    slug: p.slug,
    description: p.description,
    url: p.url ?? '',
    repoUrl: p.repoUrl ?? '',
    imageUrl: p.imageUrl ?? '',
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
    spans: p.spans.map(toSpanModel),
  };
}

export function toProjectRequest(m: ProjectModel, skillIds: string[]): CreateProjectRequest {
  const slug = textOrNull(m.slug);
  return {
    ...(slug && { slug }),
    title: m.title.trim(),
    description: m.description.trim(),
    url: textOrNull(m.url),
    repoUrl: textOrNull(m.repoUrl),
    imageUrl: textOrNull(m.imageUrl),
    startDate: textOrNull(m.startDate),
    endDate: textOrNull(m.endDate),
    skillIds,
    spans: m.spans.map(toSpanInput),
  };
}

export const projectSchema = schema<ProjectModel>((p) => {
  required(p.title, { message: 'Title is required' });
  maxLength(p.title, 120, { message: 'Use at most 120 characters' });
  pattern(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Use lowercase letters and digits separated by dashes',
  });
  required(p.description, { message: 'Description is required' });
  maxLength(p.description, 2000, { message: 'Use at most 2000 characters' });
  httpUrl(p.url);
  httpUrl(p.repoUrl);
  httpUrl(p.imageUrl);
  endOnOrAfterStart(p.startDate, p.endDate);
  applyEach(p.spans, (span) => {
    required(span.name, { message: 'Name the span' });
    maxLength(span.name, 120, { message: 'Use at most 120 characters' });
    required(span.startDate, { message: 'Start date is required' });
    endOnOrAfterStart(span.startDate, span.endDate);
    maxLength(span.note, 2000, { message: 'Use at most 2000 characters' });
  });
  // The outline rules the API applies (nesting, parents, project dates), once every span has
  // its start date (missing ones already have their own error).
  validate(p.spans, ({ value, valueOf }) => {
    const spans = value();
    if (spans.some((s) => !s.startDate)) return undefined;
    const project = {
      startDate: valueOf(p.startDate) || null,
      endDate: valueOf(p.endDate) || null,
    };
    return spanOutlineErrors(
      spans.map((s) => ({ ...s, name: s.name.trim(), endDate: s.endDate || null })),
      project,
    )
      .filter((message) => !message.endsWith("can't end before it starts"))
      .map((message) => ({ kind: 'outline', message }));
  });
});
