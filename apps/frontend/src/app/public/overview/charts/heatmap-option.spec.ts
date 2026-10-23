import { dashboardFixture, TEST_PALETTE } from '../testing/dashboard-fixture';
import { heatmapOption } from './heatmap-option';

describe('heatmapOption (technologies per year)', () => {
  const usage = dashboardFixture().skillUsage;

  it('has a cell per skill and year with the months of use', () => {
    const option = heatmapOption(usage, TEST_PALETTE);
    expect(option.xAxis).toMatchObject({ type: 'category', data: ['2024', '2025', '2026'] });
    // Most used skill at the top: the y axis is listed bottom-up.
    expect(option.yAxis).toMatchObject({ type: 'category', data: ['NgRx', 'Angular'] });
    const [series] = option.series as { type: string; data: number[][] }[];
    expect(series.type).toBe('heatmap');
    expect(series.data).toContainEqual([0, 1, 12]); // Angular 2024
    expect(series.data).toContainEqual([2, 0, 0]); // NgRx 2026
    expect(series.data).toHaveLength(6);
  });

  it('scales colors from 0 to 12 months', () => {
    expect(heatmapOption(usage, TEST_PALETTE).visualMap).toMatchObject({ min: 0, max: 12 });
  });

  it('keeps the most used skills only', () => {
    expect(heatmapOption(usage, TEST_PALETTE, 1).yAxis).toMatchObject({ data: ['Angular'] });
  });
});
