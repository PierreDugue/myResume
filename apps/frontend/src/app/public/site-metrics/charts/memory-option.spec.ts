import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { BASE_MS, sampleAt } from '../testing/process-fixture';
import { memoryOption } from './memory-option';

describe('memoryOption', () => {
  const samples = [
    sampleAt(0, { memoryMb: { rss: 100, heapTotal: 60, heapUsed: 40 } }),
    sampleAt(1, { memoryMb: { rss: 110.5, heapTotal: 64, heapUsed: 45.5 } }),
  ];
  const option = memoryOption(samples, TEST_PALETTE);
  const series = option.series as { name: string; type: string; data: number[][] }[];

  it('draws the RSS, the heap total and the heap used as three lines', () => {
    expect(series.map((s) => [s.name, s.type])).toEqual([
      ['RSS (MB)', 'line'],
      ['Heap total (MB)', 'line'],
      ['Heap used (MB)', 'line'],
    ]);
    expect(series[0].data).toEqual([
      [BASE_MS, 100],
      [BASE_MS + 1000, 110.5],
    ]);
    expect(series[1].data).toEqual([
      [BASE_MS, 60],
      [BASE_MS + 1000, 64],
    ]);
    expect(series[2].data).toEqual([
      [BASE_MS, 40],
      [BASE_MS + 1000, 45.5],
    ]);
  });

  it('keeps each line apart: three different palette colors, named in the legend', () => {
    expect(option.legend).toMatchObject({
      data: ['RSS (MB)', 'Heap total (MB)', 'Heap used (MB)'],
    });
    const colors = option.color as string[];
    expect(new Set(colors).size).toBe(3);
    expect(colors.every((c) => TEST_PALETTE.series.includes(c))).toBe(true);
  });

  it('measures in megabytes', () => {
    expect(option.yAxis).toMatchObject({ axisLabel: { formatter: '{value} MB' } });
  });
});
