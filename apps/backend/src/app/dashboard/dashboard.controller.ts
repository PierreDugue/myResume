import { Controller, Get, Query } from '@nestjs/common';
import type { DashboardResponse } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Every panel of the Career Overview (docs/api-contract.md, Dashboard). */
  @Public()
  @Get()
  get(@Query() query: DashboardQueryDto): Promise<DashboardResponse> {
    return this.dashboard.get(query);
  }
}
