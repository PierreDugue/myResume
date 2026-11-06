import type { ProcessSample } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { points, timeSeriesOption } from './time-axis';

const P50 = 'p50 (ms)';
const P99 = 'p99 (ms)';

/** "Event loop lag": the median and the 99th percentile of the delay, per second, in ms. */
export function eventLoopOption(samples: ProcessSample[], palette: ChartPalette): ChartOption {
  const line = (name: string, pick: (s: ProcessSample) => number) => ({
    type: 'line',
    name,
    showSymbol: false,
    data: points(samples, pick),
  });
  return timeSeriesOption(samples, palette, {
    colors: [palette.series[0], palette.series[1]],
    legend: [P50, P99],
    unit: 'ms',
    series: [line(P50, (s) => s.eventLoopLagMs.p50), line(P99, (s) => s.eventLoopLagMs.p99)],
  });
}
