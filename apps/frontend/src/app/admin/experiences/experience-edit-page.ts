import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { Experience, HighlightLevel, Skill } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { showError } from '../shared/form-utils';
import { SkillPicker } from '../shared/skill-picker/skill-picker';
import {
  EMPTY_EXPERIENCE,
  ExperienceModel,
  HighlightModel,
  MAX_LABELS,
  experienceSchema,
  toExperienceModel,
  toExperienceRequest,
  toHighlightModel,
} from './experience-form';

@Component({
  selector: 'app-experience-edit-page',
  imports: [FormField, FormRoot, RouterLink, SkillPicker],
  templateUrl: './experience-edit-page.html',
  styleUrl: './experience-edit-page.scss',
})
export class ExperienceEditPage {
  private readonly content = inject(ContentApi);
  private readonly model = signal<ExperienceModel>(EMPTY_EXPERIENCE);

  protected readonly levels: HighlightLevel[] = ['achievement', 'info', 'learning', 'milestone'];
  protected readonly selectedSkills = signal<string[]>([]);
  protected readonly skills = rxResource({ stream: () => this.content.skills.list() });
  protected readonly page = editPage<Experience>(
    () => this.content.experiences.list(),
    (e) => {
      this.model.set(toExperienceModel(e));
      this.selectedSkills.set([...e.skillIds]);
    },
  );
  protected readonly form = form(this.model, experienceSchema, {
    submission: {
      action: () => {
        const body = toExperienceRequest(this.model(), this.selectedSkills());
        const api = this.content.experiences;
        const { isNew, id } = this.page;
        return this.page.save(isNew ? api.create(body) : api.update(id, body));
      },
    },
  });
  protected readonly showError = showError;
  protected readonly maxLabels = MAX_LABELS;

  /** The skills an achievement can use: the job's tech stack, plus any it already has. */
  protected techOptions(selected: string[]): Skill[] {
    const all = this.skills.hasValue() ? this.skills.value() : [];
    const offered = new Set([...this.selectedSkills(), ...selected]);
    return all.filter((s) => offered.has(s.id));
  }

  protected extrasSummary(h: HighlightModel): string {
    const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const tech = h.skillIds.length === 1 ? '1 technology' : `${h.skillIds.length} technologies`;
    return `${tech}, ${count(h.labels.length, 'label')}`;
  }

  protected addLabel(index: number): void {
    this.updateHighlight(index, (h) => ({ ...h, labels: [...h.labels, { key: '', value: '' }] }));
  }

  protected removeLabel(index: number, labelIndex: number): void {
    this.updateHighlight(index, (h) => ({
      ...h,
      labels: h.labels.filter((_, i) => i !== labelIndex),
    }));
  }

  protected addHighlight(): void {
    this.updateHighlights((list) => [...list, toHighlightModel()]);
  }

  protected removeHighlight(index: number): void {
    this.updateHighlights((list) => list.filter((_, i) => i !== index));
  }

  protected moveHighlight(index: number, delta: -1 | 1): void {
    const target = index + delta;
    this.updateHighlights((list) => {
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  private updateHighlight(index: number, change: (h: HighlightModel) => HighlightModel): void {
    this.updateHighlights((list) => list.map((h, i) => (i === index ? change(h) : h)));
  }

  private updateHighlights(change: (list: HighlightModel[]) => HighlightModel[]): void {
    this.model.update((m) => ({ ...m, highlights: change(m.highlights) }));
  }
}
