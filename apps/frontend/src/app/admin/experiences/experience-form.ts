import { applyEach, maxLength, required, schema, validate } from '@angular/forms/signals';
import type {
  CreateExperienceRequest,
  Experience,
  Highlight,
  HighlightInput,
  HighlightLevel,
  Impact,
} from '@my-resume/api-models';
import { RESERVED_LABELS } from '@my-resume/resume-metrics';
import { endOnOrAfterStart, textOrNull } from '../shared/form-utils';

/** The experience form model, shared by the experience screen and the in-place resume editor. */
export interface ImpactModel {
  metric: string;
  before: number | null;
  after: number | null;
  changePct: number | null;
  unit: string;
  direction: Impact['direction'];
}

export interface LabelModel {
  key: string;
  value: string;
}

/** Same rules as the API: see docs/api-contract.md, highlight labels. */
const LABEL_KEY = /^[a-z][a-z0-9_]{0,29}$/;
export const MAX_LABELS = 10;

export interface HighlightModel {
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

export interface ExperienceModel {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  summary: string;
  highlights: HighlightModel[];
}

export const EMPTY_EXPERIENCE: ExperienceModel = {
  company: '',
  role: '',
  location: '',
  startDate: '',
  endDate: '',
  summary: '',
  highlights: [],
};

export function toHighlightModel(h?: Highlight): HighlightModel {
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

export function toExperienceModel(e: Experience): ExperienceModel {
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

export function toHighlightInput(h: HighlightModel): HighlightInput {
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

export function toExperienceRequest(
  m: ExperienceModel,
  skillIds: string[],
): CreateExperienceRequest {
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

export const experienceSchema = schema<ExperienceModel>((e) => {
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
});
