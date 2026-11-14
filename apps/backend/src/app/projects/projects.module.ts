import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsModule } from '../skills/skills.module';
import { ProjectSpanEntity } from './entities/project-span.entity';
import { ProjectEntity } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ResumeCacheModule } from '../resume/resume-cache';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity, ProjectSpanEntity]),
    SkillsModule,
    ResumeCacheModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
