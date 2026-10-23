import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ChartInstance, ChartOption, ECHARTS_LOADER } from './echarts-loader';

/** Thin ECharts wrapper: lazy-loads ECharts, applies `options`, resizes with its box, cleans up. */
@Component({
  selector: 'app-echart',
  template: `<div #box class="chart" role="img" [attr.aria-label]="label()"></div>`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .chart {
      width: 100%;
      height: 100%;
      min-height: 240px;
    }
  `,
})
export class EChart {
  readonly options = input.required<ChartOption>();
  /** Text alternative of the chart. */
  readonly label = input.required<string>();
  /** ECharts click events (the clicked item is in `params.data`). */
  readonly chartClick = output<unknown>();

  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly loader = inject(ECHARTS_LOADER);
  private readonly chart = signal<ChartInstance | null>(null);

  constructor() {
    let observer: ResizeObserver | undefined;
    let destroyed = false;

    afterNextRender(() => {
      void this.loader().then((echarts) => {
        if (destroyed) return;
        const element = this.box().nativeElement;
        const chart = echarts.init(element, null, { renderer: 'canvas' });
        this.chart.set(chart);
        chart.on?.('click', (params) => this.chartClick.emit(params));
        if (typeof ResizeObserver !== 'undefined') {
          // Resize on the next frame (once per frame): resizing inside the observer callback
          // makes browsers report a "ResizeObserver loop" error.
          let frame: number | null = null;
          observer = new ResizeObserver(() => {
            if (frame !== null || destroyed) return;
            frame = requestAnimationFrame(() => {
              frame = null;
              if (!destroyed) chart.resize();
            });
          });
          observer.observe(element);
        }
      });
    });

    effect(() => {
      const chart = this.chart();
      const options = this.options();
      if (chart) chart.setOption(options, { notMerge: true });
    });

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      observer?.disconnect();
      this.chart()?.dispose();
    });
  }
}
