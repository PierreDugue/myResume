import { Controller, Get } from '@nestjs/common';
import type { ResumeResponse } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { ResumeService } from './resume.service';

/** Everything public in one call (plain view). */
@Controller('resume')
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Public()
  @Get()
  get(): Promise<ResumeResponse> {
    return this.resume.get();
  }
}
