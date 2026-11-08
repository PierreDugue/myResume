import type { ProcessSample } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { points, timeSeriesOption } from './time-axis';

const RSS = 'RSS (MB)';
const HEAP_TOTAL = 'Heap total (MB)';
const HEAP_USED = 'Heap used (MB)';

/** "Memory": resident set size, and the V8 heap (reserved and used), in MB. */
export function memoryOption(samples: ProcessSample[], palette: ChartPalette): ChartOption {
  const line = (name: string, pick: (s: ProcessSample) => number) => ({
    type: 'line',
    name,
    showSymbol: false,
    data: points(samples, pick),
  });
  return timeSeriesOption(samples, palette, {
    colors: [palette.series[0], palette.series[3], palette.series[1]],
    legend: [RSS, HEAP_TOTAL, HEAP_USED],
    unit: 'MB',
    series: [
      line(RSS, (s) => s.memoryMb.rss),
      line(HEAP_TOTAL, (s) => s.memoryMb.heapTotal),
      line(HEAP_USED, (s) => s.memoryMb.heapUsed),
    ],
  });
}
