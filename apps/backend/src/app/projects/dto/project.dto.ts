import { PartialType } from '@nestjs/mapped-types';
import type {
  CreateProjectRequest,
  Project,
  ProjectSpan,
  ProjectSpanInput,
} from '@my-resume/api-models';
import { MAX_SPAN_DEPTH } from '@my-resume/resume-metrics';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IsHttpUrl,
  IsIsoDate,
  IsOnOrAfter,
  IsOptionalButNotNull,
  IsSlug,
} from '../../common/validators';
import type { ProjectSpanEntity } from '../entities/project-span.entity';
import type { ProjectEntity } from '../entities/project.entity';
import { orderedSkillIds } from '../../skills/dto/skill.dto';

export class ProjectSpanInputDto implements ProjectSpanInput {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsInt()
  @Min(0)
  @Max(MAX_SPAN_DEPTH)
  depth!: number;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsIsoDate()
  startDate!: string;

  @IsIsoDate({ optional: true })
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  skillIds?: string[];
}

export class CreateProjectDto implements CreateProjectRequest {
  @IsOptionalButNotNull()
  @IsString()
  @Length(1, 80)
  @IsSlug()
  slug?: string;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @Length(1, 2000)
  description!: string;

  @IsOptional()
  @IsHttpUrl()
  url?: string | null;

  @IsOptional()
  @IsHttpUrl()
  repoUrl?: string | null;

  @IsOptional()
  @IsHttpUrl()
  imageUrl?: string | null;

  @IsIsoDate({ optional: true })
  startDate?: string | null;

  @IsIsoDate({ optional: true })
  @IsOnOrAfter('startDate')
  endDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProjectSpanInputDto)
  spans?: ProjectSpanInputDto[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto, {
  skipNullProperties: false,
}) {}

export function toProject(e: ProjectEntity): Project {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    url: e.url,
    repoUrl: e.repoUrl,
    imageUrl: e.imageUrl,
    startDate: e.startDate,
    endDate: e.endDate,
    skillIds: orderedSkillIds(e.skills),
    spans: toSpans(e.spans ?? []),
    sortOrder: e.sortOrder,
  };
}

/** The outline, in order, with each span's depth worked out from its parents. */
export function toSpans(spans: ProjectSpanEntity[]): ProjectSpan[] {
  const sorted = [...spans].sort((a, b) => a.sortOrder - b.sortOrder);
  const depth = new Map<string, number>();
  return sorted.map((s) => {
    const d = s.parentId ? (depth.get(s.parentId) ?? 0) + 1 : 0;
    depth.set(s.id, d);
    return {
      id: s.id,
      parentId: s.parentId,
      depth: d,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      note: s.note,
      skillIds: orderedSkillIds(s.skills),
      sortOrder: s.sortOrder,
    };
  });
}
