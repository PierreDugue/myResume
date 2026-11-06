import type { ProcessSample } from '@my-resume/api-models';
import { Test } from '@nestjs/testing';
import { CLOCK, type Clock } from '../common/clock';
import { PROCESS_METRIC_SOURCES, type ProcessMetricSources } from './process-metric-sources';
import { ProcessMetricsService } from './process-metrics.service';

const START = Date.UTC(2026, 10, 5, 10, 0, 0); // 2026-11-05T10:00:00.000Z

/** Sources whose readings don't change; the clock follows Vitest's fake timers. */
function fakeSources(): ProcessMetricSources {
  return {
    takeEventLoopDelay: () => ({ p50Ms: 0.5, p99Ms: 2 }),
    memory: () => ({ rss: 80_000_000, heapTotal: 40_000_000, heapUsed: 30_000_000 }),
    cpuUsage: () => ({ user: 0, system: 0 }),
    monotonicMs: () => Date.now(),
    takeGcPauses: () => [],
    uptimeSeconds: () => 120 + (Date.now() - START) / 1000,
    dispose: vi.fn(),
  };
}

const clock: Clock = { now: () => new Date() };

describe('ProcessMetricsService', () => {
  let service: ProcessMetricsService;
  let sources: ProcessMetricSources;

  async function start() {
    sources = fakeSources();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessMetricsService,
        { provide: PROCESS_METRIC_SOURCES, useValue: sources },
        { provide: CLOCK, useValue: clock },
      ],
    }).compile();
    service = moduleRef.get(ProcessMetricsService);
    await moduleRef.init();
    return moduleRef;
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with an empty history, intervalMs 1000 and the process start time', async () => {
    const moduleRef = await start();
    expect(service.history()).toEqual({
      startedAt: '2026-11-05T09:58:00.000Z', // now − 120 s of uptime
      intervalMs: 1000,
      samples: [],
    });
    await moduleRef.close();
  });

  it('takes one sample per second', async () => {
    const moduleRef = await start();
    vi.advanceTimersByTime(3000);
    const { samples } = service.history();
    expect(samples.map((s) => s.ts)).toEqual([
      '2026-11-05T10:00:01.000Z',
      '2026-11-05T10:00:02.000Z',
      '2026-11-05T10:00:03.000Z',
    ]);
    expect(samples[0]).toMatchObject({
      uptimeSeconds: 121,
      memoryMb: { rss: 80, heapTotal: 40, heapUsed: 30 },
      eventLoopLagMs: { p50: 0.5, p99: 2 },
    });
    await moduleRef.close();
  });

  it('computes startedAt once: it does not drift as time passes', async () => {
    const moduleRef = await start();
    const before = service.history().startedAt;
    vi.advanceTimersByTime(10_000);
    expect(service.history().startedAt).toBe(before);
    await moduleRef.close();
  });

  it('keeps only the last 300 samples (5 minutes), oldest first', async () => {
    const moduleRef = await start();
    vi.advanceTimersByTime(305_000);
    const { samples } = service.history();
    expect(samples).toHaveLength(300);
    expect(samples[0].ts).toBe('2026-11-05T10:00:06.000Z');
    expect(samples[299].ts).toBe('2026-11-05T10:05:05.000Z');
    await moduleRef.close();
  });

  it('pushes every sample to samples$', async () => {
    const moduleRef = await start();
    const received: ProcessSample[] = [];
    const subscription = service.samples$.subscribe((s) => received.push(s));
    vi.advanceTimersByTime(2000);
    expect(received.map((s) => s.ts)).toEqual([
      '2026-11-05T10:00:01.000Z',
      '2026-11-05T10:00:02.000Z',
    ]);
    expect(received).toEqual(service.history().samples);
    subscription.unsubscribe();
    await moduleRef.close();
  });

  describe('history(sinceMs)', () => {
    it('returns only the samples strictly after `since`', async () => {
      const moduleRef = await start();
      vi.advanceTimersByTime(5000);
      const since = Date.UTC(2026, 10, 5, 10, 0, 3); // the 3rd sample's ts: excluded
      expect(service.history(since).samples.map((s) => s.ts)).toEqual([
        '2026-11-05T10:00:04.000Z',
        '2026-11-05T10:00:05.000Z',
      ]);
      await moduleRef.close();
    });

    it('returns the whole buffer for a `since` older than the buffer', async () => {
      const moduleRef = await start();
      vi.advanceTimersByTime(3000);
      expect(service.history(0).samples).toHaveLength(3);
      await moduleRef.close();
    });

    it('returns no samples for a `since` in the future', async () => {
      const moduleRef = await start();
      vi.advanceTimersByTime(3000);
      expect(service.history(START + 60_000)).toMatchObject({ intervalMs: 1000, samples: [] });
      await moduleRef.close();
    });

    it('returns the whole buffer without `since`', async () => {
      const moduleRef = await start();
      vi.advanceTimersByTime(3000);
      expect(service.history(undefined).samples).toHaveLength(3);
      await moduleRef.close();
    });
  });

  it('stops sampling and releases the sources on shutdown', async () => {
    const moduleRef = await start();
    vi.advanceTimersByTime(2000);
    const received: ProcessSample[] = [];
    service.samples$.subscribe((s) => received.push(s));
    await moduleRef.close();

    vi.advanceTimersByTime(5000);
    expect(service.history().samples).toHaveLength(2);
    expect(received).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(sources.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not keep the process alive: the timer is unref()ed', async () => {
    const unref = vi.fn();
    const realSetInterval = globalThis.setInterval;
    const spy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((
      fn: () => void,
      ms: number,
    ) => {
      const timer = realSetInterval(fn, ms);
      timer.unref = unref.mockReturnValue(timer);
      return timer;
    }) as typeof setInterval);
    const moduleRef = await start();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(unref).toHaveBeenCalled();
    spy.mockRestore();
    await moduleRef.close();
  });
});
