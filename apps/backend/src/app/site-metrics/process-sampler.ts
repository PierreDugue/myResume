import type { ProcessSample } from '@my-resume/api-models';
import type { Clock } from '../common/clock';
import type { GcPause, ProcessMetricSources } from './process-metric-sources';

const BYTES_PER_MB = 1_000_000;

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Turns raw process readings into one `ProcessSample` covering the time since the previous call
 * (the first one: since construction), with the contract's units and rounding. No Nest, no timer.
 */
export class ProcessSampler {
  private lastCpuUs: number;
  private lastWallMs: number;
  private lastTsMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly sources: ProcessMetricSources,
    private readonly clock: Clock,
  ) {
    this.lastCpuUs = this.cpuUs();
    this.lastWallMs = sources.monotonicMs();
  }

  sample(): ProcessSample {
    const cpuUs = this.cpuUs();
    const wallMs = this.sources.monotonicMs();
    const elapsedUs = (wallMs - this.lastWallMs) * 1000;
    const cpuPercent = elapsedUs > 0 ? ((cpuUs - this.lastCpuUs) / elapsedUs) * 100 : 0;
    this.lastCpuUs = cpuUs;
    this.lastWallMs = wallMs;

    const lag = this.sources.takeEventLoopDelay();
    const memory = this.sources.memory();
    return {
      ts: this.nextTs(),
      uptimeSeconds: Math.floor(this.sources.uptimeSeconds()),
      eventLoopLagMs: { p50: round(lag.p50Ms, 2), p99: round(lag.p99Ms, 2) },
      memoryMb: {
        rss: round(memory.rss / BYTES_PER_MB, 1),
        heapTotal: round(memory.heapTotal / BYTES_PER_MB, 1),
        heapUsed: round(memory.heapUsed / BYTES_PER_MB, 1),
      },
      cpuPercent: round(Math.max(0, cpuPercent), 1),
      gc: summarizeGc(this.sources.takeGcPauses()),
    };
  }

  private cpuUs(): number {
    const { user, system } = this.sources.cpuUsage();
    return user + system;
  }

  /** The clock time, kept strictly increasing (the `since` cursor relies on it) if the wall clock stalls or goes back. */
  private nextTs(): string {
    const ms = Math.max(this.clock.now().getTime(), this.lastTsMs + 1);
    this.lastTsMs = ms;
    return new Date(ms).toISOString();
  }
}

function summarizeGc(pauses: readonly GcPause[]): ProcessSample['gc'] {
  let minorCount = 0;
  let minorMs = 0;
  let majorCount = 0;
  let majorMs = 0;
  for (const pause of pauses) {
    if (pause.major) {
      majorCount++;
      majorMs += pause.durationMs;
    } else {
      minorCount++;
      minorMs += pause.durationMs;
    }
  }
  return { minorCount, minorMs: round(minorMs, 2), majorCount, majorMs: round(majorMs, 2) };
}
