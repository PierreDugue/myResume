import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  FormField,
  FormRoot,
  applyEach,
  form,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type {
  CreateExperienceRequest,
  Experience,
  Highlight,
  HighlightInput,
  HighlightLevel,
  Impact,
  Skill,
} from '@my-resume/api-models';
import { RESERVED_LABELS } from '@my-resume/resume-metrics';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { endOnOrAfterStart, showError, textOrNull } from '../shared/form-utils';
import { SkillPicker } from '../shared/skill-picker/skill-picker';

interface ImpactModel {
  metric: string;
  before: number | null;
  after: number | null;
  changePct: number | null;
  unit: string;
  direction: Impact['direction'];
}

interface LabelModel {
  key: string;
  value: string;
}

/** Same rules as the API: see docs/api-contract.md, highlight labels. */
const LABEL_KEY = /^[a-z][a-z0-9_]{0,29}$/;
const MAX_LABELS = 10;

interface HighlightModel {
  /** '' for a new highlight. */
  id: string;
  message: string;
  date: string;
  level: HighlightLevel;
  hasImpact: boolean;
  /** Kept while `hasImpact` is off, so unticking and ticking again loses nothing. */
  impact: ImpactModel;
  skillIds: string[];
  labels: LabelModel[];
}

interface ExperienceModel {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  summary: string;
  highlights: HighlightModel[];
}

const empty: ExperienceModel = {
  company: '',
  role: '',
  location: '',
  startDate: '',
  endDate: '',
  summary: '',
  highlights: [],
};

function toHighlightModel(h?: Highlight): HighlightModel {
  return {
    id: h?.id ?? '',
    message: h?.message ?? '',
    date: h?.date ?? '',
    level: h?.level ?? 'info',
    hasImpact: !!h?.impact,
    impact: {
      metric: h?.impact?.metric ?? '',
      before: h?.impact?.before ?? null,
      after: h?.impact?.after ?? null,
      changePct: h?.impact?.changePct ?? null,
      unit: h?.impact?.unit ?? '',
      direction: h?.impact?.direction ?? 'down-is-good',
    },
    skillIds: [...(h?.skillIds ?? [])],
    labels: Object.entries(h?.labels ?? {}).map(([key, value]) => ({ key, value })),
  };
}

function toModel(e: Experience): ExperienceModel {
  return {
    company: e.company,
    role: e.role,
    location: e.location ?? '',
    startDate: e.startDate,
    endDate: e.endDate ?? '',
    summary: e.summary ?? '',
    highlights: e.highlights.map(toHighlightModel),
  };
}

function toHighlightInput(h: HighlightModel): HighlightInput {
  return {
    ...(h.id && { id: h.id }),
    date: h.date,
    level: h.level,
    message: h.message.trim(),
    impact: h.hasImpact
      ? {
          metric: h.impact.metric.trim(),
          before: h.impact.before,
          after: h.impact.after,
          changePct: h.impact.changePct,
          unit: textOrNull(h.impact.unit),
          direction: h.impact.direction,
        }
      : null,
    labels: Object.fromEntries(h.labels.map((l) => [l.key.trim(), l.value.trim()])),
    skillIds: h.skillIds,
  };
}

function toRequest(m: ExperienceModel, skillIds: string[]): CreateExperienceRequest {
  return {
    company: m.company.trim(),
    role: m.role.trim(),
    location: textOrNull(m.location),
    startDate: m.startDate,
    endDate: textOrNull(m.endDate),
    summary: textOrNull(m.summary),
    skillIds,
    highlights: m.highlights.map(toHighlightInput),
  };
}

@Component({
  selector: 'app-experience-edit-page',
  imports: [FormField, FormRoot, RouterLink, SkillPicker],
  templateUrl: './experience-edit-page.html',
  styleUrl: './experience-edit-page.scss',
})
export class ExperienceEditPage {
  private readonly content = inject(ContentApi);
  private readonly model = signal<ExperienceModel>(empty);

  protected readonly levels: HighlightLevel[] = ['achievement', 'info', 'learning', 'milestone'];
  protected readonly selectedSkills = signal<string[]>([]);
  protected readonly skills = rxResource({ stream: () => this.content.skills.list() });
  protected readonly page = editPage<Experience>(
    () => this.content.experiences.list(),
    (e) => {
      this.model.set(toModel(e));
      this.selectedSkills.set([...e.skillIds]);
    },
  );
  protected readonly form = form(
    this.model,
    (e) => {
      required(e.company, { message: 'Company is required' });
      maxLength(e.company, 120, { message: 'Use at most 120 characters' });
      required(e.role, { message: 'Role is required' });
      maxLength(e.role, 120, { message: 'Use at most 120 characters' });
      required(e.startDate, { message: 'Start date is required' });
      endOnOrAfterStart(e.startDate, e.endDate);
      applyEach(e.highlights, (h) => {
        required(h.message, { message: 'Describe the achievement' });
        maxLength(h.message, 2000, { message: 'Use at most 2000 characters' });
        required(h.date, { message: 'Date is required' });
        validate(h.impact.metric, ({ value, valueOf }) =>
          valueOf(h.hasImpact) && !value().trim()
            ? { kind: 'impactMetric', message: 'Name the metric of this impact' }
            : undefined,
        );
        applyEach(h.labels, (label) => {
          required(label.key, { message: 'Name is required' });
          validate(label.key, ({ value, valueOf }) => {
            const key = value().trim();
            if (!key) return undefined;
            if (!LABEL_KEY.test(key)) {
              return {
                kind: 'labelKey',
                message: 'Use lowercase letters, digits and _, starting with a letter (30 at most)',
              };
            }
            if (RESERVED_LABELS.includes(key)) {
              return { kind: 'labelReserved', message: `"${key}" is set automatically` };
            }
            const uses = valueOf(h.labels).filter((l) => l.key.trim() === key).length;
            return uses > 1
              ? { kind: 'labelDuplicate', message: 'This label is already used' }
              : undefined;
          });
          required(label.value, { message: 'Value is required' });
          maxLength(label.value, 60, { message: 'Use at most 60 characters' });
        });
      });
    },
    {
      submission: {
        action: () => {
          const body = toRequest(this.model(), this.selectedSkills());
          const api = this.content.experiences;
          const { isNew, id } = this.page;
          return this.page.save(isNew ? api.create(body) : api.update(id, body));
        },
      },
    },
  );
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
