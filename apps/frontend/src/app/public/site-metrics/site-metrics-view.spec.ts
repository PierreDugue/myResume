import {
  cpuTable,
  eventLoopTable,
  gcLastMinute,
  gcTable,
  liveUptimeSeconds,
  memoryTable,
  processStats,
} from './site-metrics-view';
import { sampleAt, samplesBetween, tsAt } from './testing/process-fixture';

describe('liveUptimeSeconds', () => {
  it('adds the whole seconds since the latest sample was received', () => {
    expect(liveUptimeSeconds(3600, 10_000, 10_000)).toBe(3600);
    expect(liveUptimeSeconds(3600, 10_000, 10_999)).toBe(3600);
    expect(liveUptimeSeconds(3600, 10_000, 13_000)).toBe(3603);
  });

  it('never goes back when the clock is read before the sample arrived', () => {
    expect(liveUptimeSeconds(3600, 10_000, 9_000)).toBe(3600);
  });
});

describe('gcLastMinute', () => {
  it('adds the pauses of the 60 s ending at the newest sample', () => {
    const window = [
      // 61 s before the newest: outside the minute.
      sampleAt(0, { gc: { minorCount: 100, minorMs: 100, majorCount: 100, majorMs: 100 } }),
      ...samplesBetween(1, 59),
      sampleAt(60, { gc: { minorCount: 2, minorMs: 1.25, majorCount: 1, majorMs: 10.5 } }),
      sampleAt(61, { gc: { minorCount: 1, minorMs: 0.5, majorCount: 0, majorMs: 0 } }),
    ];
    // 61 - 60 = 1: the sample at second 1 is already outside (half-open window).
    expect(gcLastMinute(window)).toEqual({ count: 4, ms: 12.25 });
  });

  it('is zero without pauses, and for an empty window', () => {
    expect(gcLastMinute(samplesBetween(0, 10))).toEqual({ count: 0, ms: 0 });
    expect(gcLastMinute([])).toEqual({ count: 0, ms: 0 });
  });

  it('does not show floating point noise', () => {
    const window = [
      sampleAt(0, { gc: { minorCount: 1, minorMs: 0.1, majorCount: 0, majorMs: 0 } }),
      sampleAt(1, { gc: { minorCount: 1, minorMs: 0.2, majorCount: 0, majorMs: 0 } }),
    ];
    expect(gcLastMinute(window).ms).toBe(0.3);
  });
});

describe('processStats', () => {
  const latest = sampleAt(10, {
    eventLoopLagMs: { p50: 1.5, p99: 12.25 },
    memoryMb: { rss: 150.2, heapTotal: 80, heapUsed: 55.5 },
    cpuPercent: 7.5,
    gc: { minorCount: 3, minorMs: 2, majorCount: 1, majorMs: 6 },
  });
  const stats = processStats([...samplesBetween(0, 9), latest], 5025);
  const byLabel = (label: string) => stats.find((s) => s.label === label);

  it('shows the six stats in order', () => {
    expect(stats.map((s) => s.label)).toEqual([
      'Uptime',
      'Event loop lag (p99)',
      'Heap used',
      'RSS',
      'CPU',
      'GC pauses, last minute',
    ]);
  });

  it('formats the uptime it is given', () => {
    expect(byLabel('Uptime')).toMatchObject({ display: '1 h 23 min' });
  });

  it('reads the latest sample: lag p99 with p50 as hint', () => {
    expect(byLabel('Event loop lag (p99)')).toEqual({
      label: 'Event loop lag (p99)',
      display: '12.25 ms',
      hint: 'p50 1.5 ms',
    });
  });

  it('shows heap used of heap total, and the RSS', () => {
    expect(byLabel('Heap used')).toMatchObject({ display: '55.5 MB', hint: 'of 80 MB' });
    expect(byLabel('RSS')).toMatchObject({ display: '150.2 MB' });
  });

  it('shows the CPU as a share of one core', () => {
    expect(byLabel('CPU')).toMatchObject({ display: '7.5 %', hint: 'of one core' });
  });

  it('counts the GC pauses of the last minute, with their total time', () => {
    // 4 pauses in the latest sample, 0 elsewhere.
    expect(byLabel('GC pauses, last minute')).toMatchObject({
      display: '4',
      hint: '8 ms paused',
    });
  });

  it('shows nothing without samples', () => {
    expect(processStats([], 0)).toEqual([]);
  });
});

describe('chart tables', () => {
  const window = [
    sampleAt(0, {
      eventLoopLagMs: { p50: 1, p99: 2.5 },
      memoryMb: { rss: 100.5, heapTotal: 60, heapUsed: 40.26 },
      cpuPercent: 3.5,
      gc: { minorCount: 2, minorMs: 1.5, majorCount: 0, majorMs: 0 },
    }),
    sampleAt(1, {
      eventLoopLagMs: { p50: 1.25, p99: 4 },
      memoryMb: { rss: 101, heapTotal: 61, heapUsed: 41 },
      cpuPercent: 10,
      gc: { minorCount: 0, minorMs: 0, majorCount: 1, majorMs: 9.75 },
    }),
  ];

  it('lists the event-loop lag, newest sample first, with the UTC time', () => {
    expect(eventLoopTable(window)).toEqual({
      columns: ['Time (UTC)', 'p50 (ms)', 'p99 (ms)'],
      rows: [
        { key: tsAt(1), cells: ['14:00:01', '1.25', '4'] },
        { key: tsAt(0), cells: ['14:00:00', '1', '2.5'] },
      ],
    });
  });

  it('lists the memory in MB', () => {
    expect(memoryTable(window)).toEqual({
      columns: ['Time (UTC)', 'RSS (MB)', 'Heap total (MB)', 'Heap used (MB)'],
      rows: [
        { key: tsAt(1), cells: ['14:00:01', '101', '61', '41'] },
        { key: tsAt(0), cells: ['14:00:00', '100.5', '60', '40.3'] },
      ],
    });
  });

  it('lists the CPU', () => {
    expect(cpuTable(window)).toEqual({
      columns: ['Time (UTC)', 'CPU (% of one core)'],
      rows: [
        { key: tsAt(1), cells: ['14:00:01', '10'] },
        { key: tsAt(0), cells: ['14:00:00', '3.5'] },
      ],
    });
  });

  it('lists the minor and major GC pauses with their counts', () => {
    expect(gcTable(window)).toEqual({
      columns: ['Time (UTC)', 'Minor (count)', 'Minor (ms)', 'Major (count)', 'Major (ms)'],
      rows: [
        { key: tsAt(1), cells: ['14:00:01', '0', '0', '1', '9.75'] },
        { key: tsAt(0), cells: ['14:00:00', '2', '1.5', '0', '0'] },
      ],
    });
  });

  it('keys each row by the full timestamp of its sample, which the displayed time cannot do', () => {
    const sameSecond = [sampleAt(0), { ...sampleAt(0), ts: '2026-11-05T14:00:00.500Z' }];
    const keys = eventLoopTable(sameSecond).rows.map((r) => r.key);
    expect(keys).toEqual(['2026-11-05T14:00:00.500Z', tsAt(0)]);
    expect(eventLoopTable(sameSecond).rows.map((r) => r.cells[0])).toEqual([
      '14:00:00',
      '14:00:00',
    ]);
  });

  it('has no rows for an empty window', () => {
    expect(eventLoopTable([]).rows).toEqual([]);
  });
});
