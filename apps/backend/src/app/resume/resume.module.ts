import { Module } from '@nestjs/common';
import { EducationModule } from '../education/education.module';
import { ExperiencesModule } from '../experiences/experiences.module';
import { ProfileModule } from '../profile/profile.module';
import { ProjectsModule } from '../projects/projects.module';
import { SkillsModule } from '../skills/skills.module';
import { ResumeController } from './resume.controller';

@Module({
  imports: [ProfileModule, SkillsModule, ExperiencesModule, EducationModule, ProjectsModule],
  controllers: [ResumeController],
})
export class ResumeModule {}
