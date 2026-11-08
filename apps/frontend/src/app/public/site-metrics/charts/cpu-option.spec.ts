import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { BASE_MS, sampleAt } from '../testing/process-fixture';
import { cpuOption } from './cpu-option';

describe('cpuOption', () => {
  const samples = [sampleAt(0, { cpuPercent: 3.5 }), sampleAt(1, { cpuPercent: 120 })];
  const option = cpuOption(samples, TEST_PALETTE);
  const series = option.series as { name: string; type: string; data: number[][] }[];

  it('draws the CPU of the process as one line', () => {
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ name: 'CPU (% of one core)', type: 'line' });
    expect(series[0].data).toEqual([
      [BASE_MS, 3.5],
      [BASE_MS + 1000, 120],
    ]);
    expect(option.color).toEqual([TEST_PALETTE.series[0]]);
  });

  it('starts the axis at 0 and allows more than 100 % (several cores)', () => {
    expect(option.yAxis).toMatchObject({ min: 0, axisLabel: { formatter: '{value} %' } });
    expect((option.yAxis as { max?: number }).max).toBeUndefined();
  });
});
