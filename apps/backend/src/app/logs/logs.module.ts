import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [ResumeModule],
  controllers: [LogsController],
  providers: [LogsService, { provide: CLOCK, useValue: systemClock }],
})
export class LogsModule {}
