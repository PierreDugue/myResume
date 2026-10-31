import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { QualityReport } from '@my-resume/api-models';
import { QUALITY_REPORT_FILE } from './quality.constants';

/**
 * Serves the quality report that CI baked into the build. The file never changes while the process
 * runs, so it is read on the first request only (no startup cost) and kept.
 */
@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);
  private report?: Promise<QualityReport | null>;

  constructor(@Inject(QUALITY_REPORT_FILE) private readonly file: string) {}

  /** The report, or null when this build has none (normal in local dev) or the file is unusable. */
  get(): Promise<QualityReport | null> {
    this.report ??= this.load();
    return this.report;
  }

  private async load(): Promise<QualityReport | null> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      return this.unusable('cannot be read');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.unusable('is not valid JSON');
    }

    if (!isReport(parsed)) return this.unusable('is not a version 1 quality report');
    return parsed;
  }

  private unusable(reason: string): null {
    this.logger.warn(`The quality report file ${reason}; /api/quality will answer 404.`);
    return null;
  }
}

function isReport(value: unknown): value is QualityReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1
  );
}
