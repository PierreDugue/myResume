import type { ProcessSample } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { points, timeSeriesOption } from './time-axis';

const MINOR = 'Minor GC (ms)';
const MAJOR = 'Major GC (ms)';

/**
 * "Garbage collection": time spent paused in GC each second, stacked minor (scavenges) and major
 * (mark-sweep-compact). Major bars carry a diagonal pattern, so the two are told apart without
 * relying on colour; the legend and the table name them too. A series' own `itemStyle.decal` is
 * drawn without `aria.decal.show` (which would add palette patterns to the minor series too).
 */
export function gcOption(samples: ProcessSample[], palette: ChartPalette): ChartOption {
  const bars = (name: string, pick: (s: ProcessSample) => number, itemStyle?: object) => ({
    type: 'bar',
    name,
    stack: 'gc',
    barMaxWidth: 8,
    ...(itemStyle ? { itemStyle } : {}),
    data: points(samples, pick),
  });
  return timeSeriesOption(samples, palette, {
    colors: [palette.series[2], palette.series[1]],
    legend: [MINOR, MAJOR],
    unit: 'ms',
    yMin: 0,
    series: [
      bars(MINOR, (s) => s.gc.minorMs),
      bars(MAJOR, (s) => s.gc.majorMs, {
        decal: {
          symbol: 'rect',
          dashArrayX: [1, 0],
          dashArrayY: [2, 3],
          rotation: Math.PI / 4,
          color: palette.surface,
        },
      }),
    ],
  });
}
