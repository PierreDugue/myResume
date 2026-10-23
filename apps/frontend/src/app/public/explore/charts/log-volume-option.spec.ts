import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import { logsFixture } from '../testing/logs-fixture';
import { logVolumeOption } from './log-volume-option';

describe('logVolumeOption (log volume)', () => {
  const option = logVolumeOption(logsFixture().volume, TEST_PALETTE);
  const series = option.series as { name: string; data: number[]; stack: string; type: string }[];

  it('stacks one bar series per level over the years', () => {
    expect(option.xAxis).toMatchObject({ type: 'category', data: ['2024', '2025', '2026'] });
    expect(series.map((s) => [s.name, s.data])).toEqual([
      ['Achievement', [0, 0, 1]],
      ['Milestone', [1, 1, 0]],
      ['Info', [0, 0, 0]],
      ['Learning', [0, 0, 0]],
    ]);
    expect(new Set(series.map((s) => `${s.type}:${s.stack}`))).toEqual(new Set(['bar:lines']));
    expect(option.legend).toMatchObject({
      data: ['Achievement', 'Milestone', 'Info', 'Learning'],
    });
  });

  it('gives each level the same color as in the log lines, whatever the data', () => {
    // info = link blue (series 1), milestone = accent (2), achievement = ok green (3), learning = 4.
    expect(option.color).toEqual([
      TEST_PALETTE.series[2],
      TEST_PALETTE.series[1],
      TEST_PALETTE.series[0],
      TEST_PALETTE.series[3],
    ]);
  });

  it('counts whole lines on the value axis and describes itself for screen readers', () => {
    expect(option.yAxis).toMatchObject({ type: 'value', minInterval: 1 });
    expect(option.aria).toMatchObject({ enabled: true });
    expect(option.tooltip).toMatchObject({ trigger: 'axis' });
  });
});
