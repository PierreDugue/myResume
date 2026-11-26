import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { Project, Skill } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { showError } from '../shared/form-utils';
import { SkillPicker } from '../shared/skill-picker/skill-picker';
import {
  EMPTY_PROJECT,
  ProjectModel,
  SpanModel,
  projectSchema,
  toProjectModel,
  toProjectRequest,
  toSpanModel,
} from './project-form';
import { canIndent, indent, moveDown, moveUp, outdent, removeSpan } from './span-outline';

@Component({
  selector: 'app-project-edit-page',
  imports: [FormField, FormRoot, RouterLink, SkillPicker],
  templateUrl: './project-edit-page.html',
  styleUrl: './project-edit-page.scss',
})
export class ProjectEditPage {
  private readonly content = inject(ContentApi);
  private readonly model = signal<ProjectModel>(EMPTY_PROJECT);
  protected readonly selectedSkills = signal<string[]>([]);
  protected readonly skills = rxResource({ stream: () => this.content.skills.list() });
  protected readonly page = editPage<Project>(
    () => this.content.projects.list(),
    (p) => {
      this.model.set(toProjectModel(p));
      this.selectedSkills.set([...p.skillIds]);
    },
  );
  protected readonly form = form(this.model, projectSchema, {
    submission: {
      action: () => {
        const body = toProjectRequest(this.model(), this.selectedSkills());
        const api = this.content.projects;
        const { isNew, id } = this.page;
        return this.page.save(isNew ? api.create(body) : api.update(id, body));
      },
    },
  });
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
