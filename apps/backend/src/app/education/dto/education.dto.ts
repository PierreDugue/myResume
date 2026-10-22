import { PartialType } from '@nestjs/mapped-types';
import type { CreateEducationRequest, Education } from '@my-resume/api-models';
import { IsOptional, IsString, Length } from 'class-validator';
import { IsIsoDate, IsOnOrAfter } from '../../common/validators';
import type { EducationEntity } from '../entities/education.entity';

export class CreateEducationDto implements CreateEducationRequest {
  @IsString()
  @Length(1, 120)
  school!: string;

  @IsString()
  @Length(1, 120)
  degree!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  field?: string | null;

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
  description?: string | null;
}

export class UpdateEducationDto extends PartialType(CreateEducationDto, {
  skipNullProperties: false,
}) {}

export function toEducation(e: EducationEntity): Education {
  return {
    id: e.id,
    school: e.school,
    degree: e.degree,
    field: e.field,
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    description: e.description,
    sortOrder: e.sortOrder,
  };
}
