import { PartialType } from '@nestjs/mapped-types';
import type { CreateSkillRequest, Skill, SkillLevel } from '@my-resume/api-models';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { IsSlug } from '../../common/validators';
import type { SkillEntity } from '../entities/skill.entity';

export class CreateSkillDto implements CreateSkillRequest {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsSlug()
  slug?: string;

  @IsString()
  @Length(1, 60)
  category!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  level?: SkillLevel | null;
}

/** PATCH: every field optional, but `null` only where the field is nullable. */
export class UpdateSkillDto extends PartialType(CreateSkillDto, { skipNullProperties: false }) {}

export function toSkill(e: SkillEntity): Skill {
  return {
    id: e.id,
    name: e.name,
    slug: e.slug,
    category: e.category,
    level: (e.level ?? null) as SkillLevel | null,
    sortOrder: e.sortOrder,
  };
}

/** Ids of linked skills, in the order of the skills list (relations come back unordered). */
export function orderedSkillIds(skills: SkillEntity[] | undefined): string[] {
  return [...(skills ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((s) => s.id);
}
