import { WINDOW_SECONDS, lastTs, mergeSamples, withinSeconds } from './sample-window';
import { sampleAt, samplesBetween, tsAt } from './testing/process-fixture';

const seconds = (samples: { ts: string }[]) =>
  samples.map((s) => (Date.parse(s.ts) - Date.parse(tsAt(0))) / 1000);

describe('mergeSamples', () => {
  it('appends new samples after the window', () => {
    expect(seconds(mergeSamples(samplesBetween(0, 2), samplesBetween(3, 4)))).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it('drops samples that are already in the window (union by ts)', () => {
    const merged = mergeSamples(samplesBetween(0, 3), samplesBetween(2, 5));
    expect(seconds(merged)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('sorts by ts when samples arrive out of order (a tick around the history ack)', () => {
    const merged = mergeSamples([sampleAt(5)], [sampleAt(7), sampleAt(3), sampleAt(4)]);
    expect(seconds(merged)).toEqual([3, 4, 5, 7]);
  });

  it('keeps the incoming version of a sample that has the same ts', () => {
    const merged = mergeSamples([sampleAt(1, { cpuPercent: 1 })], [sampleAt(1, { cpuPercent: 9 })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].cpuPercent).toBe(9);
  });

  it('keeps the newest 300 by default', () => {
    const merged = mergeSamples(samplesBetween(0, 299), samplesBetween(300, 304));
    expect(merged).toHaveLength(300);
    expect(seconds(merged)[0]).toBe(5);
    expect(seconds(merged)[299]).toBe(304);
  });

  it('keeps the newest `max` when the caller sets one', () => {
    expect(seconds(mergeSamples(samplesBetween(0, 4), [], 3))).toEqual([2, 3, 4]);
  });

  it('keeps the series going after a backend restart (new uptime, later ts)', () => {
    const merged = mergeSamples(
      [sampleAt(1, { uptimeSeconds: 900 })],
      [sampleAt(2, { uptimeSeconds: 1 })],
    );
    expect(merged.map((s) => s.uptimeSeconds)).toEqual([900, 1]);
  });

  it('does not change the arrays it is given', () => {
    const window = samplesBetween(1, 2);
    const incoming = [sampleAt(0)];
    mergeSamples(window, incoming);
    expect(seconds(window)).toEqual([1, 2]);
    expect(seconds(incoming)).toEqual([0]);
  });

  it('returns an empty window for nothing', () => {
    expect(mergeSamples([], [])).toEqual([]);
  });
});

describe('lastTs', () => {
  it('is the ts of the newest sample', () => {
    expect(lastTs(samplesBetween(0, 9))).toBe(tsAt(9));
  });

  it('is undefined for an empty window (ask for everything)', () => {
    expect(lastTs([])).toBeUndefined();
  });
});

describe('withinSeconds', () => {
  const window = samplesBetween(0, 200);

  it('keeps the samples of the last N seconds, measured from the newest sample', () => {
    expect(seconds(withinSeconds(window, 3))).toEqual([198, 199, 200]);
  });

  it('keeps exactly N samples at one sample per second', () => {
    expect(withinSeconds(window, 60)).toHaveLength(60);
    expect(withinSeconds(window, WINDOW_SECONDS)).toHaveLength(120);
  });

  it('keeps everything when the window is shorter than N seconds', () => {
    expect(withinSeconds(samplesBetween(0, 9), 120)).toHaveLength(10);
  });

  it('does not depend on the browser clock (a skewed clock cannot empty the charts)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2031-01-01T00:00:00Z'));
      expect(withinSeconds(window, 5)).toHaveLength(5);
      vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
      expect(withinSeconds(window, 5)).toHaveLength(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is empty for an empty window', () => {
    expect(withinSeconds([], 60)).toEqual([]);
  });

  it('follows gaps in time: samples are cut by their ts, not by their count', () => {
    const gappy = [sampleAt(0), sampleAt(1), sampleAt(50), sampleAt(100)];
    expect(seconds(withinSeconds(gappy, 60))).toEqual([50, 100]);
  });
});
