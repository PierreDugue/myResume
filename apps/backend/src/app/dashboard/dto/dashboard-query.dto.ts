import type { DashboardQuery } from '@my-resume/api-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length } from 'class-validator';

/** Query string of GET /api/dashboard. Range rules (bounds, from ≤ to) live in buildDashboard. */
export class DashboardQueryDto implements DashboardQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  skill?: string;
}
