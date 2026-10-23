import { Injectable } from '@nestjs/common';
import type { ResumeResponse } from '@my-resume/api-models';
import { EducationService } from '../education/education.service';
import { ExperiencesService } from '../experiences/experiences.service';
import { ProfileService } from '../profile/profile.service';
import { ProjectsService } from '../projects/projects.service';
import { SkillsService } from '../skills/skills.service';

/** The public resume bundle, shared by GET /api/resume and the dashboard. */
@Injectable()
export class ResumeService {
  constructor(
    private readonly profile: ProfileService,
    private readonly experiences: ExperiencesService,
    private readonly education: EducationService,
    private readonly skills: SkillsService,
    private readonly projects: ProjectsService,
  ) {}

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
