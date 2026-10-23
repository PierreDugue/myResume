import { Controller, Get, Param } from '@nestjs/common';
import type { Trace, TraceSummary } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { TracesService } from './traces.service';

@Controller('traces')
export class TracesController {
  constructor(private readonly traces: TracesService) {}

  /** The trace search: every project that has dates or spans. */
  @Public()
  @Get()
  list(): Promise<TraceSummary[]> {
    return this.traces.list();
  }

  /** One project's waterfall. Unknown slugs are a 404, so the slug needs no other validation. */
  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string): Promise<Trace> {
    return this.traces.get(slug);
  }
}
