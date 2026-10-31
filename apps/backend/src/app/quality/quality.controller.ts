import { Controller, Get, NotFoundException } from '@nestjs/common';
import type { QualityReport } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { QualityService } from './quality.service';

@Controller('quality')
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Public()
  @Get()
  async get(): Promise<QualityReport> {
    const report = await this.quality.get();
    if (!report) throw new NotFoundException('No quality report in this build');
    return report;
  }
}
