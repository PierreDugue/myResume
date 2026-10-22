import { Controller, Get } from '@nestjs/common';
import type { ResumeResponse } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { EducationService } from '../education/education.service';
import { ExperiencesService } from '../experiences/experiences.service';
import { ProfileService } from '../profile/profile.service';
import { ProjectsService } from '../projects/projects.service';
import { SkillsService } from '../skills/skills.service';

/** Everything public in one call (plain view, dashboards). */
@Controller('resume')
export class ResumeController {
  constructor(
    private readonly profile: ProfileService,
    private readonly experiences: ExperiencesService,
    private readonly education: EducationService,
    private readonly skills: SkillsService,
    private readonly projects: ProjectsService,
  ) {}

  @Public()
  @Get()
  async get(): Promise<ResumeResponse> {
    const [profile, experiences, education, skills, projects] = await Promise.all([
      this.profile.getPublic(),
      this.experiences.list(),
      this.education.list(),
      this.skills.list(),
      this.projects.list(),
    ]);
    return { profile, experiences, education, skills, projects };
  }
}
