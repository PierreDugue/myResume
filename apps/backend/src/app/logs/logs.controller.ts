import { Controller, Get, Query } from '@nestjs/common';
import type { LogLabel, LogsResponse } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { LogsQueryDto } from './dto/logs-query.dto';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  /** Log lines matching a LogQL-style query and a year range. */
  @Public()
  @Get()
  search(@Query() query: LogsQueryDto): Promise<LogsResponse> {
    return this.logs.search(query);
  }

  /** Label names and values, for autocomplete. */
  @Public()
  @Get('labels')
  labels(): Promise<LogLabel[]> {
    return this.logs.labels();
  }
}
