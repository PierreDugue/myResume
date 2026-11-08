import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { BASE_MS, sampleAt } from '../testing/process-fixture';
import { eventLoopOption } from './event-loop-option';

describe('eventLoopOption', () => {
  const samples = [
    sampleAt(0, { eventLoopLagMs: { p50: 1, p99: 2.5 } }),
    sampleAt(1, { eventLoopLagMs: { p50: 1.5, p99: 8 } }),
  ];
  const option = eventLoopOption(samples, TEST_PALETTE);
  const series = option.series as { name: string; type: string; data: number[][] }[];

  it('draws the p50 and the p99 as two lines over time', () => {
    expect(series.map((s) => [s.name, s.type])).toEqual([
      ['p50 (ms)', 'line'],
      ['p99 (ms)', 'line'],
    ]);
    expect(series[0].data).toEqual([
      [BASE_MS, 1],
      [BASE_MS + 1000, 1.5],
    ]);
    expect(series[1].data).toEqual([
      [BASE_MS, 2.5],
      [BASE_MS + 1000, 8],
    ]);
  });

  it('names both lines in the legend and gives them the first two palette colors', () => {
    expect(option.legend).toMatchObject({ data: ['p50 (ms)', 'p99 (ms)'] });
    expect(option.color).toEqual([TEST_PALETTE.series[0], TEST_PALETTE.series[1]]);
  });

  it('measures in milliseconds on a time axis', () => {
    expect(option.xAxis).toMatchObject({ type: 'time' });
    expect(option.yAxis).toMatchObject({ axisLabel: { formatter: '{value} ms' } });
  });
});
