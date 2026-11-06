import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { BASE_MS, sampleAt } from '../testing/process-fixture';
import { gcOption } from './gc-option';

describe('gcOption', () => {
  const samples = [
    sampleAt(0, { gc: { minorCount: 2, minorMs: 1.5, majorCount: 0, majorMs: 0 } }),
    sampleAt(1, { gc: { minorCount: 0, minorMs: 0, majorCount: 1, majorMs: 9.75 } }),
  ];
  const option = gcOption(samples, TEST_PALETTE);
  const series = option.series as {
    name: string;
    type: string;
    stack: string;
    data: number[][];
    itemStyle?: { decal?: { symbol?: string } };
  }[];

  it('draws the pause time of each second as stacked bars, minor then major', () => {
    expect(series.map((s) => [s.name, s.type, s.stack])).toEqual([
      ['Minor GC (ms)', 'bar', 'gc'],
      ['Major GC (ms)', 'bar', 'gc'],
    ]);
    expect(series[0].data).toEqual([
      [BASE_MS, 1.5],
      [BASE_MS + 1000, 0],
    ]);
    expect(series[1].data).toEqual([
      [BASE_MS, 0],
      [BASE_MS + 1000, 9.75],
    ]);
  });

  it('tells major from minor by more than colour: a pattern on the major bars, and the legend', () => {
    expect(series[0].itemStyle?.decal).toBeUndefined();
    expect(series[1].itemStyle?.decal?.symbol).toBeDefined();
    expect(option.legend).toMatchObject({ data: ['Minor GC (ms)', 'Major GC (ms)'] });
    expect(option.color).toEqual([TEST_PALETTE.series[2], TEST_PALETTE.series[1]]);
  });

  it('patterns only the major series: aria is on, but without the palette decals that would also pattern minor', () => {
    // ECharts draws a series' own itemStyle.decal whatever `aria` says; `aria.decal.show` only adds
    // palette decals to every series (checked in node_modules/echarts: visual/style.js, visual/aria.js).
    expect(option.aria).toMatchObject({ enabled: true });
    expect(option.aria).not.toMatchObject({ decal: { show: true } });
  });

  it('measures pause time in milliseconds', () => {
    expect(option.yAxis).toMatchObject({ axisLabel: { formatter: '{value} ms' } });
  });
});
