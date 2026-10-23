import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  FormField,
  FormRoot,
  applyEach,
  form,
  maxLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type {
  CreateProjectRequest,
  Project,
  ProjectSpan,
  ProjectSpanInput,
  Skill,
} from '@my-resume/api-models';
import { spanOutlineErrors } from '@my-resume/resume-metrics';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { endOnOrAfterStart, httpUrl, showError, textOrNull } from '../shared/form-utils';
import { SkillPicker } from '../shared/skill-picker/skill-picker';
import { canIndent, indent, moveDown, moveUp, outdent, removeSpan } from './span-outline';

interface SpanModel {
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

interface ProjectModel {
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

const empty: ProjectModel = {
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

function toSpanModel(s?: ProjectSpan): SpanModel {
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

function toModel(p: Project): ProjectModel {
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

function toRequest(m: ProjectModel, skillIds: string[]): CreateProjectRequest {
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

@Component({
  selector: 'app-project-edit-page',
  imports: [FormField, FormRoot, RouterLink, SkillPicker],
  templateUrl: './project-edit-page.html',
  styleUrl: './project-edit-page.scss',
})
export class ProjectEditPage {
  private readonly content = inject(ContentApi);
  private readonly model = signal<ProjectModel>(empty);
  protected readonly selectedSkills = signal<string[]>([]);
  protected readonly skills = rxResource({ stream: () => this.content.skills.list() });
  protected readonly page = editPage<Project>(
    () => this.content.projects.list(),
    (p) => {
      this.model.set(toModel(p));
      this.selectedSkills.set([...p.skillIds]);
    },
  );
  protected readonly form = form(
    this.model,
    (p) => {
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
    },
    {
      submission: {
        action: () => {
          const body = toRequest(this.model(), this.selectedSkills());
          const api = this.content.projects;
          const { isNew, id } = this.page;
          return this.page.save(isNew ? api.create(body) : api.update(id, body));
        },
      },
    },
  );
  /** The three URL fields, rendered with the same markup. */
  protected readonly links = [
    { id: 'pr-url', label: 'Website URL', field: this.form.url },
    { id: 'pr-repo-url', label: 'Repository URL', field: this.form.repoUrl },
    { id: 'pr-image-url', label: 'Image URL', field: this.form.imageUrl },
  ];
  protected readonly showError = showError;

  /** The skills a span can use: the project's tech stack, plus any it already has. */
  protected techOptions(selected: string[]): Skill[] {
    const all = this.skills.hasValue() ? this.skills.value() : [];
    const offered = new Set([...this.selectedSkills(), ...selected]);
    return all.filter((s) => offered.has(s.id));
  }

  protected readonly canIndent = (index: number) => canIndent(this.model().spans, index);
  protected readonly canMoveUp = (index: number) =>
    moveUp(this.model().spans, index) !== this.model().spans;
  protected readonly canMoveDown = (index: number) =>
    moveDown(this.model().spans, index) !== this.model().spans;

  protected addSpan(): void {
    this.updateSpans((spans) => [...spans, toSpanModel()]);
  }

  protected indent(index: number): void {
    this.updateSpans((spans) => indent(spans, index));
  }

  protected outdent(index: number): void {
    this.updateSpans((spans) => outdent(spans, index));
  }

  protected moveUp(index: number): void {
    this.updateSpans((spans) => moveUp(spans, index));
  }

  protected moveDown(index: number): void {
    this.updateSpans((spans) => moveDown(spans, index));
  }

  protected removeSpan(index: number): void {
    this.updateSpans((spans) => removeSpan(spans, index));
  }

  private updateSpans(change: (spans: SpanModel[]) => SpanModel[]): void {
    this.model.update((m) => ({ ...m, spans: change(m.spans) }));
  }
}
