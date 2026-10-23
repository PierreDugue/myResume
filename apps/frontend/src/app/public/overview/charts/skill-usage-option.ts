import type { SkillUsage } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';

/** "Skills over time": experience (years) accumulated by the end of each year, one line per skill. */
export function skillUsageOption(usage: SkillUsage, palette: ChartPalette, top = 8): ChartOption {
  const series = usage.series.slice(0, top);
  const axisLabel = { color: palette.muted };
  return {
    aria: { enabled: true, decal: { show: false } },
    color: palette.series,
    textStyle: { color: palette.text },
    tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v} yrs` },
    legend: {
      type: 'scroll',
      top: 0,
      data: series.map((s) => s.name),
      textStyle: { color: palette.text },
      pageTextStyle: { color: palette.muted },
    },
    grid: { left: 36, right: 16, top: 64, bottom: 24 },
    xAxis: {
      type: 'category',
      data: usage.years.map(String),
      boundaryGap: false,
      axisLabel,
      axisLine: { lineStyle: { color: palette.border } },
    },
    yAxis: {
      type: 'value',
      name: 'years',
      nameGap: 12,
      nameTextStyle: { color: palette.muted, align: 'right' },
      axisLabel,
      splitLine: { lineStyle: { color: palette.border } },
    },
    series: series.map((s) => ({
      type: 'line',
      name: s.name,
      data: s.cumulativeYears,
      showSymbol: false,
      emphasis: { focus: 'series' },
    })),
  };
}
