import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { PreferencesModule } from '../preferences/preferences.module';

@Module({
  imports: [ResumeModule, PreferencesModule],
  controllers: [LogsController],
  providers: [LogsService, { provide: CLOCK, useValue: systemClock }],
})
export class LogsModule {}
