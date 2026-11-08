import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ProcessMetricsHistory, ProcessSample } from '@my-resume/api-models';
import { Observable, Subject } from 'rxjs';
import { CLOCK, type Clock } from '../common/clock';
import { RingBuffer } from '../common/ring-buffer';
import { PROCESS_METRIC_SOURCES, type ProcessMetricSources } from './process-metric-sources';
import { ProcessSampler } from './process-sampler';

export const SAMPLE_INTERVAL_MS = 1000;
/** 5 minutes of samples. */
export const HISTORY_CAPACITY = 300;

/**
 * Samples the backend's own process once per second, always (an in-memory timer, never the
 * database), keeps the last 5 minutes and publishes each sample on `samples$`. Knows nothing of
 * HTTP or sockets.
 */
@Injectable()
export class ProcessMetricsService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly subject = new Subject<ProcessSample>();
  readonly samples$: Observable<ProcessSample> = this.subject.asObservable();

  private readonly buffer = new RingBuffer<ProcessSample>(HISTORY_CAPACITY);
  private readonly sampler: ProcessSampler;
  private readonly startedAt: string;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    @Inject(PROCESS_METRIC_SOURCES) private readonly sources: ProcessMetricSources,
    @Inject(CLOCK) clock: Clock,
  ) {
    this.sampler = new ProcessSampler(sources, clock);
    this.startedAt = new Date(
      Math.round(clock.now().getTime() - sources.uptimeSeconds() * 1000),
    ).toISOString();
  }

  onModuleInit(): void {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => this.tick(), SAMPLE_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  onApplicationShutdown(): void {
    this.stop();
  }

  /** The buffered samples, oldest first; with `sinceMs`, only those strictly after it. */
  history(sinceMs?: number): ProcessMetricsHistory {
    const all = this.buffer.toArray();
    const samples =
      sinceMs === undefined ? all : all.filter((sample) => Date.parse(sample.ts) > sinceMs);
    return { startedAt: this.startedAt, intervalMs: SAMPLE_INTERVAL_MS, samples };
  }

  private tick(): void {
    const sample = this.sampler.sample();
    this.buffer.push(sample);
    this.subject.next(sample);
  }

  private stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.subject.complete();
    this.sources.dispose();
  }
}
