import { PartialType } from '@nestjs/mapped-types';
import type { CreateProjectRequest, Project } from '@my-resume/api-models';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { IsHttpUrl, IsIsoDate, IsOnOrAfter, IsSlug } from '../../common/validators';
import type { ProjectEntity } from '../entities/project.entity';
import { orderedSkillIds } from '../../skills/dto/skill.dto';

export class CreateProjectDto implements CreateProjectRequest {
  @IsOptional()
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
    sortOrder: e.sortOrder,
  };
}
