import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock';
import { PreferencesModule } from '../preferences/preferences.module';
import { createNodeProcessSources, PROCESS_METRIC_SOURCES } from './process-metric-sources';
import { ProcessMetricsService } from './process-metrics.service';
import { SiteMetricsController } from './site-metrics.controller';

/** The backend's own process health ("This site, observed"), over HTTP; LiveModule streams it. */
@Module({
  imports: [PreferencesModule],
  controllers: [SiteMetricsController],
  providers: [
    ProcessMetricsService,
    { provide: PROCESS_METRIC_SOURCES, useFactory: createNodeProcessSources },
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [ProcessMetricsService],
})
export class SiteMetricsModule {}
