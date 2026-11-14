import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EducationController } from './education.controller';
import { EducationService } from './education.service';
import { EducationEntity } from './entities/education.entity';
import { ResumeCacheModule } from '../resume/resume-cache';

@Module({
  imports: [TypeOrmModule.forFeature([EducationEntity]), ResumeCacheModule],
  controllers: [EducationController],
  providers: [EducationService],
  exports: [EducationService],
})
export class EducationModule {}
