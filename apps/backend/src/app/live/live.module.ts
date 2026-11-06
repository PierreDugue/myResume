import { Module } from '@nestjs/common';
import { PreferencesModule } from '../preferences/preferences.module';
import { SiteMetricsModule } from '../site-metrics/site-metrics.module';
import { LiveGateway } from './live.gateway';

/** The `/live` Socket.IO namespace. Future channels (logs, events, ...) add rooms and handlers here. */
@Module({
  imports: [SiteMetricsModule, PreferencesModule],
  providers: [LiveGateway],
})
export class LiveModule {}
