import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { ServiceMapController } from './service-map.controller';
import { ServiceMapService } from './service-map.service';
import { PreferencesModule } from '../preferences/preferences.module';

@Module({
  imports: [ResumeModule, PreferencesModule],
  controllers: [ServiceMapController],
  providers: [ServiceMapService, { provide: CLOCK, useValue: systemClock }],
})
export class ServiceMapModule {}
