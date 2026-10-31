import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PreferencesModule } from '../preferences/preferences.module';

@Module({
  imports: [ResumeModule, PreferencesModule],
  controllers: [DashboardController],
  providers: [DashboardService, { provide: CLOCK, useValue: systemClock }],
})
export class DashboardModule {}
