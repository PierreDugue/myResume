import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { ServiceMapController } from './service-map.controller';
import { ServiceMapService } from './service-map.service';

@Module({
  imports: [ResumeModule],
  controllers: [ServiceMapController],
  providers: [ServiceMapService, { provide: CLOCK, useValue: systemClock }],
})
export class ServiceMapModule {}
