import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { BASE_MS, samplesBetween } from '../testing/process-fixture';
import { points, timeSeriesOption } from './time-axis';

describe('points', () => {
  it('pairs each sample time (ms since epoch) with the picked value', () => {
    const samples = samplesBetween(0, 2);
    expect(points(samples, (s) => s.uptimeSeconds)).toEqual([
      [BASE_MS, 3600],
      [BASE_MS + 1000, 3601],
      [BASE_MS + 2000, 3602],
    ]);
  });
});

describe('timeSeriesOption', () => {
  const build = (samples = samplesBetween(0, 200)) =>
    timeSeriesOption(samples, TEST_PALETTE, {
      colors: ['#a', '#b'],
      legend: ['One', 'Two'],
      unit: 'ms',
      series: [{ name: 'One' }],
    });

  it('shows the last 2 minutes, ending at the latest sample, in UTC', () => {
    const option = build();
    expect(option.xAxis).toMatchObject({
      type: 'time',
      min: BASE_MS + 80_000,
      max: BASE_MS + 200_000,
    });
    expect(option.useUTC).toBe(true);
  });

  it('measures the window from the latest sample, not from the browser clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
      expect(build().xAxis).toMatchObject({ max: BASE_MS + 200_000 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the axis range open while there are no samples', () => {
    const axis = build([]).xAxis as { min?: number; max?: number };
    expect(axis.min).toBeUndefined();
    expect(axis.max).toBeUndefined();
  });

  it('does not animate, so a chart redrawn every second does not wobble', () => {
    expect(build().animation).toBe(false);
  });

  it('describes itself for screen readers and takes its colors and legend from the arguments', () => {
    const option = build();
    expect(option.aria).toMatchObject({ enabled: true });
    expect(option.color).toEqual(['#a', '#b']);
    expect(option.legend).toMatchObject({ data: ['One', 'Two'] });
    expect(option.series).toEqual([{ name: 'One' }]);
    expect(option.tooltip).toMatchObject({ trigger: 'axis' });
  });

  it('writes the unit on the value axis labels', () => {
    expect(build().yAxis).toMatchObject({ type: 'value', axisLabel: { formatter: '{value} ms' } });
  });

  it('draws text, axes and grid lines in the theme colors', () => {
    const option = build();
    expect(option.textStyle).toMatchObject({ color: TEST_PALETTE.text });
    expect(option.yAxis).toMatchObject({
      axisLabel: { color: TEST_PALETTE.muted },
      splitLine: { lineStyle: { color: TEST_PALETTE.border } },
    });
  });
});
