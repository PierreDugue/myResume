import { Controller, Get, Query } from '@nestjs/common';
import type { ProcessMetricsHistory } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { PublicPage } from '../preferences/public-page.decorator';
import { ProcessMetricsQueryDto } from './dto/process-metrics-query.dto';
import { ProcessMetricsService } from './process-metrics.service';

@PublicPage('siteMetrics')
@Controller('site-metrics')
export class SiteMetricsController {
  constructor(private readonly metrics: ProcessMetricsService) {}

  /** The HTTP fallback of the socket's metrics channel. `since` is validated and converted by the DTO. */
  @Public()
  @Get('process')
  process(@Query() query: ProcessMetricsQueryDto): ProcessMetricsHistory {
    return this.metrics.history(query.since);
  }
}
