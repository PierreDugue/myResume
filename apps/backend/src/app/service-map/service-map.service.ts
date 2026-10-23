import { Inject, Injectable } from '@nestjs/common';
import type { ServiceMapResponse } from '@my-resume/api-models';
import { buildServiceMap } from '@my-resume/resume-metrics';
import { CLOCK, Clock, today } from '../common/clock';
import { ResumeService } from '../resume/resume.service';

/** Technologies linked to jobs and projects (docs/api-contract.md, Service map). */
@Injectable()
export class ServiceMapService {
  constructor(
    private readonly resume: ResumeService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(): Promise<ServiceMapResponse> {
    return buildServiceMap(await this.resume.get(), today(this.clock));
  }
}
