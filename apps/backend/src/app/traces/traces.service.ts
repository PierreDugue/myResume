import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Trace, TraceSummary } from '@my-resume/api-models';
import { buildTrace, buildTraces } from '@my-resume/resume-metrics';
import { CLOCK, Clock, today } from '../common/clock';
import { ResumeService } from '../resume/resume.service';

/** Projects as traces (docs/api-contract.md, Traces). */
@Injectable()
export class TracesService {
  constructor(
    private readonly resume: ResumeService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(): Promise<TraceSummary[]> {
    return buildTraces(await this.resume.get(), today(this.clock));
  }

  async get(slug: string): Promise<Trace> {
    const trace = buildTrace(await this.resume.get(), slug, today(this.clock));
    if (!trace) throw new NotFoundException(`No trace for project "${slug}"`);
    return trace;
  }
}
