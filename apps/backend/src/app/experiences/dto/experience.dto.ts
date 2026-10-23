import { PartialType } from '@nestjs/mapped-types';
import type {
  CreateExperienceRequest,
  Experience,
  Highlight,
  HighlightInput,
  HighlightLevel,
  Impact,
} from '@my-resume/api-models';
import { RESERVED_LABELS } from '@my-resume/resume-metrics';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  registerDecorator,
  ValidateNested,
} from 'class-validator';
import { IsIsoDate, IsOnOrAfter } from '../../common/validators';
import type { ExperienceEntity } from '../entities/experience.entity';
import { orderedSkillIds } from '../../skills/dto/skill.dto';
import type { HighlightEntity } from '../entities/highlight.entity';

const LEVELS: HighlightLevel[] = ['achievement', 'info', 'learning', 'milestone'];
const LABEL_KEY = /^[a-z][a-z0-9_]{0,29}$/;
const MAX_LABELS = 10;

function isHighlightLabels(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_LABELS &&
    entries.every(
      ([key, v]) =>
        LABEL_KEY.test(key) &&
        !RESERVED_LABELS.includes(key) &&
        typeof v === 'string' &&
        v.length >= 1 &&
        v.length <= 60,
    )
  );
}

/** Highlight labels: at most 10, `^[a-z][a-z0-9_]{0,29}$` keys that aren't reserved, 1..60 character values. */
function IsHighlightLabels(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isHighlightLabels',
      target: target.constructor,
      propertyName: propertyName as string,
      validator: {
        validate: isHighlightLabels,
        defaultMessage: () =>
          `labels must have at most ${MAX_LABELS} entries, keys of lowercase letters, digits and "_" (not ${RESERVED_LABELS.join(', ')}), and values of 1 to 60 characters`,
      },
    });
}

export class ImpactDto implements Impact {
  @IsString()
  @Length(1, 120)
  metric!: string;

  @IsOptional()
  @IsNumber()
  before!: number | null;

  @IsOptional()
  @IsNumber()
  after!: number | null;

  @IsOptional()
  @IsNumber()
  changePct!: number | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit!: string | null;

  @IsIn(['up-is-good', 'down-is-good'])
  direction!: Impact['direction'];
}

export class HighlightInputDto implements HighlightInput {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIsoDate()
  date!: string;

  @IsIn(LEVELS)
  level!: HighlightLevel;

  @IsString()
  @Length(1, 2000)
  message!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImpactDto)
  impact?: ImpactDto | null;

  @IsOptional()
  @IsHighlightLabels()
  labels?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  skillIds?: string[];
}

export class CreateExperienceDto implements CreateExperienceRequest {
  @IsString()
  @Length(1, 120)
  company!: string;

  @IsString()
  @Length(1, 120)
  role!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  location?: string | null;

  @IsIsoDate()
  startDate!: string;

  @IsIsoDate({ optional: true })
  @IsOnOrAfter('startDate')
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  summary?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => HighlightInputDto)
  highlights?: HighlightInputDto[];
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto, {
  skipNullProperties: false,
}) {}

export function toHighlight(h: HighlightEntity): Highlight {
  return {
    id: h.id,
    date: h.date,
    level: h.level,
    message: h.message,
    impact: h.impact ?? null,
    labels: h.labels ?? {},
    skillIds: orderedSkillIds(h.skills),
    sortOrder: h.sortOrder,
  };
}

export function toExperience(e: ExperienceEntity): Experience {
  return {
    id: e.id,
    company: e.company,
    role: e.role,
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    summary: e.summary,
    skillIds: orderedSkillIds(e.skills),
    highlights: [...(e.highlights ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toHighlight),
    sortOrder: e.sortOrder,
  };
}
