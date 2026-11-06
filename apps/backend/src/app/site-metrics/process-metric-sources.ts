import {
  constants,
  monitorEventLoopDelay,
  performance,
  PerformanceObserver,
  type NodeGCPerformanceDetail,
  type PerformanceEntry,
} from 'node:perf_hooks';

export interface GcPause {
  durationMs: number;
  /** Mark-sweep-compact; everything else (scavenge, incremental marking, weak callbacks) is minor. */
  major: boolean;
}

/**
 * What the process exposes about itself, behind an interface so the sampler and the service are
 * tested with fakes. `createNodeProcessSources()` is the only code reading perf_hooks/process.
 */
export interface ProcessMetricSources {
  /** Event-loop delay percentiles since the previous call (then reset), in ms. */
  takeEventLoopDelay(): { p50Ms: number; p99Ms: number };
  /** Bytes. */
  memory(): { rss: number; heapTotal: number; heapUsed: number };
  /** Cumulative CPU time of the process, in µs. */
  cpuUsage(): { user: number; system: number };
  /** Monotonic clock, in ms. */
  monotonicMs(): number;
  /** GC pauses observed since the previous call. */
  takeGcPauses(): GcPause[];
  uptimeSeconds(): number;
  /** Stops the histogram and the GC observer. Idempotent. */
  dispose(): void;
}

export const PROCESS_METRIC_SOURCES = Symbol('PROCESS_METRIC_SOURCES');

/** Event-loop histogram sampling period (Node's default). */
const EVENT_LOOP_RESOLUTION_MS = 10;

/** GC pauses kept between two takes: a bound in case nobody takes them (normally ~0–20 per second). */
const MAX_PENDING_GC_PAUSES = 10_000;

const NS_PER_MS = 1e6;

export function createNodeProcessSources(): ProcessMetricSources {
  const histogram = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  histogram.enable();

  let gcPauses: GcPause[] = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (gcPauses.length >= MAX_PENDING_GC_PAUSES) break;
      // Node ≥ 16 puts the GC kind in `detail` (the old `entry.kind` accessor is deprecated).
      const { detail } = entry as PerformanceEntry & { detail?: NodeGCPerformanceDetail };
      gcPauses.push({
        durationMs: entry.duration,
        major: detail?.kind === constants.NODE_PERFORMANCE_GC_MAJOR,
      });
    }
  });
  observer.observe({ entryTypes: ['gc'] });

  /**
   * The histogram records the whole interval between two of its timer callbacks, so an idle loop
   * reports the resolution itself. Measured on Node 24.22 (macOS), idle: p50 ≈ 10.7 ms and p99 ≈
   * 11.4 ms with a 10 ms resolution (20.99 / 21.53 ms with 20 ms). Subtracting the resolution gives
   * the actual delay: ≈ 0.7 ms idle, and ≈ 45 ms p99 when the loop is blocked 50 ms at a time.
   * An empty histogram (no timer fired yet) reports garbage (min = 2^63), hence the count check.
   */
  const delayMs = (percentile: number) =>
    histogram.count === 0
      ? 0
      : Math.max(0, histogram.percentile(percentile) / NS_PER_MS - EVENT_LOOP_RESOLUTION_MS);

  let disposed = false;

  return {
    takeEventLoopDelay: () => {
      const result = { p50Ms: delayMs(50), p99Ms: delayMs(99) };
      histogram.reset();
      return result;
    },
    memory: () => {
      const { rss, heapTotal, heapUsed } = process.memoryUsage();
      return { rss, heapTotal, heapUsed };
    },
    cpuUsage: () => {
      const { user, system } = process.cpuUsage();
      return { user, system };
    },
    monotonicMs: () => performance.now(),
    takeGcPauses: () => {
      const pauses = gcPauses;
      gcPauses = [];
      return pauses;
    },
    uptimeSeconds: () => process.uptime(),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      histogram.disable();
      observer.disconnect();
      gcPauses = [];
    },
  };
}
