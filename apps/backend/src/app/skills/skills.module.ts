import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillEntity } from './entities/skill.entity';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { ResumeCacheModule } from '../resume/resume-cache';

@Module({
  imports: [TypeOrmModule.forFeature([SkillEntity]), ResumeCacheModule],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
