import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { DashboardQuery, DashboardResponse } from '@my-resume/api-models';
import { buildDashboard, DashboardQueryError } from '@my-resume/resume-metrics';
import { CLOCK, Clock, today } from '../common/clock';
import { PreferencesService } from '../preferences/preferences.service';
import { ResumeService } from '../resume/resume.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly resume: ResumeService,
    private readonly preferences: PreferencesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(query: DashboardQuery): Promise<DashboardResponse> {
    const [resume, skillsOverTime] = await Promise.all([
      this.resume.get(),
      this.preferences.storedSkillsOverTime(),
    ]);
    try {
      return buildDashboard({ resume, today: today(this.clock), query, skillsOverTime });
    } catch (error) {
      if (error instanceof DashboardQueryError) throw new BadRequestException([error.message]);
      throw error;
    }
  }
}
