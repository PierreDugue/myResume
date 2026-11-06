import type { ProcessMetricsQuery } from '@my-resume/api-models';
import { Transform } from 'class-transformer';
import { IsNumber, ValidateIf } from 'class-validator';
import { parseSince, SINCE_MESSAGE } from '../since';

/**
 * Query of GET /api/site-metrics/process. `since` is the contract's ISO 8601 string on the wire,
 * parsed once here (see parseSince): after the transform it holds the epoch ms the service wants,
 * hence `implements` on the keys only.
 */
export class ProcessMetricsQueryDto implements Partial<Record<keyof ProcessMetricsQuery, unknown>> {
  /** Epoch ms. An invalid value becomes NaN, which `@IsNumber()` refuses (one rule, one message). */
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : (parseSince(value) ?? Number.NaN),
  )
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsNumber({}, { message: SINCE_MESSAGE })
  since?: number;
}
