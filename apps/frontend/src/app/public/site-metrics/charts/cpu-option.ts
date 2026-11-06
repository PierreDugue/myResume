import type { ProcessSample } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { points, timeSeriesOption } from './time-axis';

const CPU = 'CPU (% of one core)';

/** "CPU": the process's share of one core per second (can go above 100 %). */
export function cpuOption(samples: ProcessSample[], palette: ChartPalette): ChartOption {
  return timeSeriesOption(samples, palette, {
    colors: [palette.series[0]],
    legend: [CPU],
    unit: '%',
    yMin: 0,
    series: [
      {
        type: 'line',
        name: CPU,
        showSymbol: false,
        data: points(samples, (s) => s.cpuPercent),
      },
    ],
  });
}
