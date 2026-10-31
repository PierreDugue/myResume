import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { QUALITY_REPORT_FILE } from './quality.constants';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';

@Module({
  controllers: [QualityController],
  providers: [
    QualityService,
    // webpack bundles the app into dist/apps/backend/main.js and copies src/assets next to it.
    { provide: QUALITY_REPORT_FILE, useValue: join(__dirname, 'assets', 'quality-report.json') },
  ],
})
export class QualityModule {}
