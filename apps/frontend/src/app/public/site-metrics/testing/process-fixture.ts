import type { ProcessMetricsHistory, ProcessSample } from '@my-resume/api-models';

/** Second 0 of every fixture: samples are `BASE + n seconds`. */
export const BASE_MS = Date.parse('2026-11-05T14:00:00.000Z');

export interface SampleOverrides {
  uptimeSeconds?: number;
  eventLoopLagMs?: Partial<ProcessSample['eventLoopLagMs']>;
  memoryMb?: Partial<ProcessSample['memoryMb']>;
  cpuPercent?: number;
  gc?: Partial<ProcessSample['gc']>;
}

/** ISO timestamp `n` seconds after the fixtures' start (`2026-11-05T14:00:00.000Z`). */
export function tsAt(n: number): string {
  return new Date(BASE_MS + n * 1000).toISOString();
}

/** The sample `n` seconds in: a quiet process whose uptime is `3600 + n`, unless overridden. */
export function sampleAt(n: number, overrides: SampleOverrides = {}): ProcessSample {
  return {
    ts: tsAt(n),
    uptimeSeconds: overrides.uptimeSeconds ?? 3600 + n,
    eventLoopLagMs: { p50: 1, p99: 2, ...overrides.eventLoopLagMs },
    memoryMb: { rss: 100, heapTotal: 60, heapUsed: 40, ...overrides.memoryMb },
    cpuPercent: overrides.cpuPercent ?? 3,
    gc: { minorCount: 0, minorMs: 0, majorCount: 0, majorMs: 0, ...overrides.gc },
  };
}

/** Samples for seconds `from`..`to` inclusive. */
export function samplesBetween(from: number, to: number): ProcessSample[] {
  return Array.from({ length: to - from + 1 }, (_, i) => sampleAt(from + i));
}

export function historyOf(
  samples: ProcessSample[],
  startedAt: string = tsAt(-3600),
): ProcessMetricsHistory {
  return { startedAt, intervalMs: 1000, samples };
}
