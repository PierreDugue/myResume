import type { ProcessSample } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { WINDOW_SECONDS, newest } from '../sample-window';

/** `[time in ms since epoch, value]` pairs: what a time axis reads. */
export function points(samples: ProcessSample[], pick: (s: ProcessSample) => number): number[][] {
  return samples.map((s) => [Date.parse(s.ts), pick(s)]);
}

/**
 * What the process charts share: a time axis over the last 2 minutes, ending at the latest sample
 * (the server's time, so the browser clock can't push the data out of view), in UTC like the
 * tables. No animation: these charts are redrawn every second.
 */
export function timeSeriesOption(
  samples: ProcessSample[],
  palette: ChartPalette,
  options: {
    colors: string[];
    legend: string[];
    /** Written after the numbers on the value axis. */
    unit: string;
    series: object[];
    /** Lowest value of the value axis; left out = automatic. */
    yMin?: number;
  },
): ChartOption {
  const latest = newest(samples);
  const max = latest ? Date.parse(latest.ts) : undefined;
  const min = max === undefined ? undefined : max - WINDOW_SECONDS * 1000;
  return {
    animation: false,
    useUTC: true,
    aria: { enabled: true },
    color: options.colors,
    textStyle: { color: palette.text },
    tooltip: { trigger: 'axis' },
    legend: { data: options.legend, top: 0, textStyle: { color: palette.text } },
    grid: { left: 56, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'time',
      min,
      max,
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.border } },
    },
    yAxis: {
      type: 'value',
      min: options.yMin,
      axisLabel: { color: palette.muted, formatter: `{value} ${options.unit}` },
      splitLine: { lineStyle: { color: palette.border } },
    },
    series: options.series,
  };
}
