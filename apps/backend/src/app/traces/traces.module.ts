import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { ResumeModule } from '../resume/resume.module';
import { TracesController } from './traces.controller';
import { TracesService } from './traces.service';

@Module({
  imports: [ResumeModule],
  controllers: [TracesController],
  providers: [TracesService, { provide: CLOCK, useValue: systemClock }],
})
export class TracesModule {}
