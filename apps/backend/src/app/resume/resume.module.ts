import { Module } from '@nestjs/common';
import { EducationModule } from '../education/education.module';
import { ExperiencesModule } from '../experiences/experiences.module';
import { ProfileModule } from '../profile/profile.module';
import { ProjectsModule } from '../projects/projects.module';
import { SkillsModule } from '../skills/skills.module';
import { ResumeCacheModule } from './resume-cache';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';

@Module({
  imports: [
    ProfileModule,
    SkillsModule,
    ExperiencesModule,
    EducationModule,
    ProjectsModule,
    ResumeCacheModule,
  ],
  controllers: [ResumeController],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
