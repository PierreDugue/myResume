import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsModule } from '../skills/skills.module';
import { ExperienceEntity } from './entities/experience.entity';
import { HighlightEntity } from './entities/highlight.entity';
import { ExperiencesController } from './experiences.controller';
import { ExperiencesService } from './experiences.service';
import { ResumeCacheModule } from '../resume/resume-cache';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExperienceEntity, HighlightEntity]),
    SkillsModule,
    ResumeCacheModule,
  ],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
