import { dashboardFixture, TEST_PALETTE } from '../testing/dashboard-fixture';
import { skillUsageOption } from './skill-usage-option';

describe('skillUsageOption (skills over time)', () => {
  const usage = dashboardFixture().skillUsage;

  it('draws one line per skill with its experience at the end of each year', () => {
    const option = skillUsageOption(usage, TEST_PALETTE);
    expect(option.xAxis).toMatchObject({ type: 'category', data: ['2024', '2025', '2026'] });
    expect(option.series).toEqual([
      expect.objectContaining({ type: 'line', name: 'Angular', data: [2.3, 3.3, 3.8] }),
      expect.objectContaining({ type: 'line', name: 'NgRx', data: [2.3, 3.3, 3.3] }),
    ]);
    expect(option.legend).toMatchObject({ data: ['Angular', 'NgRx'] });
  });

  it('draws every series it is given, without slicing (the backend limits them)', () => {
    const many = {
      ...usage,
      series: Array.from({ length: 10 }, (_, i) => ({
        ...usage.series[0],
        skillId: `s${i}`,
        name: `Skill ${i}`,
      })),
    };
    const option = skillUsageOption(many, TEST_PALETTE);
    const names = many.series.map((s) => s.name);
    expect((option.series as { name: string }[]).map((s) => s.name)).toEqual(names);
    expect(option.legend).toMatchObject({ data: names });
  });

  it('draws an empty chart when there are no series', () => {
    const option = skillUsageOption({ years: usage.years, series: [] }, TEST_PALETTE);
    expect(option.series).toEqual([]);
    expect(option.legend).toMatchObject({ data: [] });
  });

  it('uses the theme palette and describes itself for screen readers', () => {
    const option = skillUsageOption(usage, TEST_PALETTE);
    expect(option.color).toEqual(TEST_PALETTE.series);
    expect(option.aria).toMatchObject({ enabled: true });
    expect(JSON.stringify(option.legend)).toContain(TEST_PALETTE.text);
  });
});
