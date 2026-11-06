import type { Clock } from '../common/clock';
import type { GcPause, ProcessMetricSources } from './process-metric-sources';
import { ProcessSampler } from './process-sampler';

/** Hand-driven sources: tests set what the next reading returns. */
function fakeSources() {
  const state = {
    cpu: { user: 0, system: 0 },
    monotonicMs: 0,
    eventLoop: { p50Ms: 0, p99Ms: 0 },
    memory: { rss: 0, heapTotal: 0, heapUsed: 0 },
    gc: [] as GcPause[],
    uptimeSeconds: 0,
  };
  const sources: ProcessMetricSources = {
    takeEventLoopDelay: () => state.eventLoop,
    memory: () => state.memory,
    cpuUsage: () => ({ ...state.cpu }),
    monotonicMs: () => state.monotonicMs,
    takeGcPauses: () => {
      const pauses = state.gc;
      state.gc = [];
      return pauses;
    },
    uptimeSeconds: () => state.uptimeSeconds,
    dispose: vi.fn(),
  };
  return { state, sources };
}

function fakeClock(iso: string) {
  let now = new Date(iso);
  const clock: Clock = { now: () => new Date(now) };
  return { clock, set: (value: string) => (now = new Date(value)) };
}

describe('ProcessSampler', () => {
  it('computes CPU % of one core over the interval since construction: 500 000 µs in 1000 ms = 50.0', () => {
    const { state, sources } = fakeSources();
    state.cpu = { user: 1_000_000, system: 200_000 };
    state.monotonicMs = 10_000;
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);

    state.cpu = { user: 1_400_000, system: 300_000 }; // +400 000 user, +100 000 system
    state.monotonicMs = 11_000;

    expect(sampler.sample().cpuPercent).toBe(50);
  });

  it('measures each sample against the previous one, not the first', () => {
    const { state, sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.cpu = { user: 1_000_000, system: 0 };
    state.monotonicMs = 1000;
    expect(sampler.sample().cpuPercent).toBe(100);

    state.cpu = { user: 1_250_000, system: 0 }; // +250 000 µs in 1000 ms
    state.monotonicMs = 2000;
    expect(sampler.sample().cpuPercent).toBe(25);
  });

  it('can exceed 100 % (several threads), rounded to 1 decimal', () => {
    const { state, sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.cpu = { user: 1_000_000, system: 234_567 }; // 1 234 567 µs over 1000 ms = 123.4567 %
    state.monotonicMs = 1000;
    expect(sampler.sample().cpuPercent).toBe(123.5);
  });

  it('uses the real elapsed wall time: 300 000 µs over 1500 ms = 20.0', () => {
    const { state, sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.cpu = { user: 300_000, system: 0 };
    state.monotonicMs = 1500;
    expect(sampler.sample().cpuPercent).toBe(20);
  });

  it('reports 0 % CPU when no wall time elapsed (no division by zero)', () => {
    const { state, sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.cpu = { user: 5000, system: 0 };
    expect(sampler.sample().cpuPercent).toBe(0);
  });

  it('converts memory to MB (1 MB = 1 000 000 bytes), 1 decimal', () => {
    const { state, sources } = fakeSources();
    state.memory = { rss: 123_456_789, heapTotal: 50_000_000, heapUsed: 24_960_000 };
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    expect(sampler.sample().memoryMb).toEqual({ rss: 123.5, heapTotal: 50, heapUsed: 25 });
  });

  it('rounds the event-loop delay to 2 decimals', () => {
    const { state, sources } = fakeSources();
    state.eventLoop = { p50Ms: 0.123_4, p99Ms: 12.345_6 };
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    expect(sampler.sample().eventLoopLagMs).toEqual({ p50: 0.12, p99: 12.35 });
  });

  it('splits GC pauses into minor and major, counts them and sums their durations (2 decimals)', () => {
    const { state, sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.gc = [
      { durationMs: 0.5, major: false },
      { durationMs: 1.256, major: false },
      { durationMs: 3.004, major: true },
      { durationMs: 0.001, major: false },
    ];
    expect(sampler.sample().gc).toEqual({
      minorCount: 3,
      minorMs: 1.76, // 1.757
      majorCount: 1,
      majorMs: 3,
    });
  });

  it('reports zero GC when no pause happened during the interval', () => {
    const { sources } = fakeSources();
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    expect(sampler.sample().gc).toEqual({ minorCount: 0, minorMs: 0, majorCount: 0, majorMs: 0 });
  });

  it('reports the uptime in whole seconds (rounded down)', () => {
    const { state, sources } = fakeSources();
    state.uptimeSeconds = 42.98;
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    expect(sampler.sample().uptimeSeconds).toBe(42);
  });

  it('stamps the sample with the clock time, as ISO', () => {
    const { sources } = fakeSources();
    const { clock, set } = fakeClock('2026-11-05T10:00:00.000Z');
    const sampler = new ProcessSampler(sources, clock);
    set('2026-11-05T10:00:01.000Z');
    expect(sampler.sample().ts).toBe('2026-11-05T10:00:01.000Z');
  });

  it('keeps `ts` strictly increasing even if the wall clock stands still or goes back', () => {
    const { sources } = fakeSources();
    const { clock, set } = fakeClock('2026-11-05T10:00:01.000Z');
    const sampler = new ProcessSampler(sources, clock);
    expect(sampler.sample().ts).toBe('2026-11-05T10:00:01.000Z');
    expect(sampler.sample().ts).toBe('2026-11-05T10:00:01.001Z');
    set('2026-11-05T09:59:00.000Z');
    expect(sampler.sample().ts).toBe('2026-11-05T10:00:01.002Z');
    set('2026-11-05T10:00:05.000Z');
    expect(sampler.sample().ts).toBe('2026-11-05T10:00:05.000Z');
  });

  it('returns a full ProcessSample with only numbers and the timestamp', () => {
    const { state, sources } = fakeSources();
    state.memory = { rss: 80_000_000, heapTotal: 40_000_000, heapUsed: 30_000_000 };
    state.uptimeSeconds = 7;
    const sampler = new ProcessSampler(sources, fakeClock('2026-11-05T10:00:00.000Z').clock);
    state.cpu = { user: 100_000, system: 0 };
    state.monotonicMs = 1000;
    expect(sampler.sample()).toEqual({
      ts: '2026-11-05T10:00:00.000Z',
      uptimeSeconds: 7,
      eventLoopLagMs: { p50: 0, p99: 0 },
      memoryMb: { rss: 80, heapTotal: 40, heapUsed: 30 },
      cpuPercent: 10,
      gc: { minorCount: 0, minorMs: 0, majorCount: 0, majorMs: 0 },
    });
  });
});
