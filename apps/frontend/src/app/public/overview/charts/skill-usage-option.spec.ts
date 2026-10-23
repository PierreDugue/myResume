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

  it('keeps the most used skills only', () => {
    const option = skillUsageOption(usage, TEST_PALETTE, 1);
    expect((option.series as { name: string }[]).map((s) => s.name)).toEqual(['Angular']);
  });

  it('uses the theme palette and describes itself for screen readers', () => {
    const option = skillUsageOption(usage, TEST_PALETTE);
    expect(option.color).toEqual(TEST_PALETTE.series);
    expect(option.aria).toMatchObject({ enabled: true });
    expect(JSON.stringify(option.legend)).toContain(TEST_PALETTE.text);
  });
});
