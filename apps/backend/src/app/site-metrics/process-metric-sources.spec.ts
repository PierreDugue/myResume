import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import {
  createNodeProcessSources,
  type GcPause,
  type ProcessMetricSources,
} from './process-metric-sources';

/** `gc()` without starting Node with --expose-gc. */
function forceGc(): void {
  setFlagsFromString('--expose-gc');
  (runInNewContext('gc') as () => void)();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long the loop is blocked in the tests below. */
const BLOCK_MS = 150;

function blockFor(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end); // block the event loop
}

/** The real Node.js sources: a smoke test of what perf_hooks and process give on this Node. */
describe('createNodeProcessSources', () => {
  let sources: ProcessMetricSources;

  beforeEach(() => {
    sources = createNodeProcessSources();
  });

  afterEach(() => sources.dispose());

  it('reports memory in bytes', () => {
    const memory = sources.memory();
    expect(memory.rss).toBeGreaterThan(1_000_000);
    expect(memory.heapTotal).toBeGreaterThan(0);
    expect(memory.heapUsed).toBeGreaterThan(0);
    expect(memory.heapUsed).toBeLessThanOrEqual(memory.heapTotal);
  });

  it('reports cumulative CPU time in µs and a monotonic clock in ms', async () => {
    const cpu1 = sources.cpuUsage();
    const t1 = sources.monotonicMs();
    const end = Date.now() + 20;
    while (Date.now() < end); // burn some CPU
    await wait(5);
    const cpu2 = sources.cpuUsage();
    expect(cpu2.user + cpu2.system).toBeGreaterThan(cpu1.user + cpu1.system);
    expect(sources.monotonicMs()).toBeGreaterThan(t1);
  });

  it('reports the uptime in seconds', () => {
    expect(sources.uptimeSeconds()).toBeGreaterThan(0);
  });

  it('reports an empty event-loop histogram as 0 ms', () => {
    expect(sources.takeEventLoopDelay()).toEqual({ p50Ms: 0, p99Ms: 0 });
  });

  it('reports a near-idle loop as a small delay, corrected for the timer resolution', async () => {
    await wait(500); // ~50 timer ticks: the median ignores the odd stall of a busy machine
    const { p50Ms, p99Ms } = sources.takeEventLoopDelay();
    expect(p50Ms).toBeGreaterThanOrEqual(0);
    // Uncorrected, the p50 of an idle loop is the 10 ms resolution plus ~1 ms: anything under 8 ms
    // shows the resolution was subtracted (an idle loop measures ~1 ms here).
    expect(p50Ms).toBeLessThan(8);
    expect(p99Ms).toBeGreaterThanOrEqual(p50Ms);
  });

  it('sees a blocked loop, far above an idle one', async () => {
    await wait(50);
    blockFor(BLOCK_MS);
    await wait(50);
    // The loop was blocked for BLOCK_MS, so one timer tick was at least that late (more on a slow
    // machine, never less): well above the idle value (~1 ms) and the 8 ms bound of the test above.
    expect(sources.takeEventLoopDelay().p99Ms).toBeGreaterThan(BLOCK_MS / 2);
  });

  it('resets the histogram on every take', async () => {
    await wait(50);
    blockFor(BLOCK_MS);
    await wait(30);
    const blocked = sources.takeEventLoopDelay().p99Ms;
    expect(blocked).toBeGreaterThan(BLOCK_MS / 2);

    await wait(300);
    // Without the reset the blocked tick would still be the p99.
    expect(sources.takeEventLoopDelay().p99Ms).toBeLessThan(blocked / 2);
  });

  it('drains the GC pauses it observed, a forced full GC being major', async () => {
    sources.takeGcPauses();
    forceGc();
    const pauses: GcPause[] = [];
    // PerformanceObserver delivers asynchronously: poll until the pauses arrive.
    await vi.waitFor(
      () => {
        pauses.push(...sources.takeGcPauses());
        expect(pauses.some((p) => p.major)).toBe(true);
      },
      { timeout: 5000, interval: 25 },
    );
    for (const p of pauses) expect(p.durationMs).toBeGreaterThanOrEqual(0);
    expect(sources.takeGcPauses()).toEqual([]);
  });

  it('stops observing after dispose', async () => {
    sources.dispose();
    forceGc();
    await wait(50);
    expect(sources.takeGcPauses()).toEqual([]);
  });
});
