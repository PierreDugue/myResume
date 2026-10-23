import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { LogLabel, LogsQuery, LogsResponse } from '@my-resume/api-models';
import { QueryParseError } from '@my-resume/query-parser';
import { buildLogs, DashboardQueryError, logLabels } from '@my-resume/resume-metrics';
import { CLOCK, Clock, today } from '../common/clock';
import { ResumeService } from '../resume/resume.service';

/** The resume as a searchable log stream (docs/api-contract.md, Explore). */
@Injectable()
export class LogsService {
  constructor(
    private readonly resume: ResumeService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async search(query: LogsQuery): Promise<LogsResponse> {
    const resume = await this.resume.get();
    try {
      return buildLogs({ resume, today: today(this.clock), query });
    } catch (error) {
      if (error instanceof QueryParseError || error instanceof DashboardQueryError) {
        throw new BadRequestException([error.message]);
      }
      throw error;
    }
  }

  async labels(): Promise<LogLabel[]> {
    return logLabels(await this.resume.get());
  }
}
