import { InjectionToken } from '@angular/core';

export interface ChartInstance {
  setOption(option: unknown, opts?: unknown): void;
  resize(): void;
  dispose(): void;
}

export interface EChartsLike {
  init(el: HTMLElement, theme?: null, opts?: { renderer: 'canvas' | 'svg' }): ChartInstance;
}

/** The ECharts option keys this app uses (kept loose: ECharts validates the details). */
export interface ChartOption {
  aria?: object;
  backgroundColor?: string;
  color?: string[];
  grid?: object;
  legend?: object;
  textStyle?: object;
  tooltip?: object;
  visualMap?: object;
  xAxis?: object;
  yAxis?: object;
  series?: object[];
}

/** Loads ECharts on demand (a separate bundle chunk). Tests provide a fake. */
export const ECHARTS_LOADER = new InjectionToken<() => Promise<EChartsLike>>('ECHARTS_LOADER', {
  providedIn: 'root',
  factory: () => () => import('./echarts-setup').then((m) => m.echarts as unknown as EChartsLike),
});
