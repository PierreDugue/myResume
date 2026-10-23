import type { HighlightLevel, LogVolume } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';

/**
 * Levels from the bottom of the stack up, with the palette slot of each: the same colors as the
 * log lines (info = link blue, milestone = accent, achievement = ok green), fixed per level.
 */
export const VOLUME_LEVELS: { level: HighlightLevel; name: string; slot: number }[] = [
  { level: 'achievement', name: 'Achievement', slot: 2 },
  { level: 'milestone', name: 'Milestone', slot: 1 },
  { level: 'info', name: 'Info', slot: 0 },
  { level: 'learning', name: 'Learning', slot: 3 },
];

/** "Log volume": matching lines per year, stacked by level. */
export function logVolumeOption(volume: LogVolume[], palette: ChartPalette): ChartOption {
  return {
    aria: { enabled: true },
    color: VOLUME_LEVELS.map((l) => palette.series[l.slot]),
    textStyle: { color: palette.text },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: VOLUME_LEVELS.map((l) => l.name),
      top: 0,
      textStyle: { color: palette.text },
    },
    grid: { left: 40, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: volume.map((v) => String(v.year)),
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.border } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: palette.muted },
      splitLine: { lineStyle: { color: palette.border } },
    },
    series: VOLUME_LEVELS.map((l) => ({
      type: 'bar',
      name: l.name,
      stack: 'lines',
      barMaxWidth: 28,
      // A thin surface-colored edge keeps stacked segments apart.
      itemStyle: { borderColor: palette.surface, borderWidth: 1 },
      emphasis: { focus: 'series' },
      data: volume.map((v) => v.levels[l.level]),
    })),
  };
}
