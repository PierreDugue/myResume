import type { LogsQuery } from '@my-resume/api-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

/** Query string of GET /api/logs. The query's own rules (syntax, length) live in the parser. */
export class LogsQueryDto implements LogsQuery {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  to?: number;
}
