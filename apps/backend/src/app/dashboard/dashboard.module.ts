import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ResumeModule],
  controllers: [DashboardController],
  providers: [DashboardService, { provide: CLOCK, useValue: systemClock }],
})
export class DashboardModule {}
