import type { SkillUsage } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';

/** "Technologies per year": months of use per skill and year, most used skill at the top. */
export function heatmapOption(usage: SkillUsage, palette: ChartPalette, top = 15): ChartOption {
  const series = usage.series.slice(0, top);
  const last = series.length - 1;
  return {
    aria: { enabled: true },
    textStyle: { color: palette.text },
    tooltip: {
      position: 'top',
      formatter: (p: { value: [number, number, number] }) =>
        `${series[last - p.value[1]]?.name} · ${usage.years[p.value[0]]}: ${p.value[2]} months`,
    },
    grid: { left: 110, right: 16, top: 8, bottom: 56 },
    xAxis: {
      type: 'category',
      data: usage.years.map(String),
      splitArea: { show: false },
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.border } },
    },
    yAxis: {
      type: 'category',
      data: series.map((s) => s.name).reverse(),
      axisLabel: { color: palette.text },
      axisLine: { lineStyle: { color: palette.border } },
    },
    visualMap: {
      min: 0,
      max: 12,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 120,
      text: ['12 months', '0'],
      textStyle: { color: palette.muted },
      // One hue, dark to bright: more months reads as "more", never as a different category.
      inRange: { color: [palette.surface, palette.series[0]] },
    },
    series: [
      {
        type: 'heatmap',
        data: series.flatMap((s, si) =>
          s.monthsPerYear.map((months, yi) => [yi, last - si, months]),
        ),
        itemStyle: { borderColor: palette.border, borderWidth: 1 },
      },
    ],
  };
}
