import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { ChartInstance, ECHARTS_LOADER } from './echarts-loader';
import { EChart } from './echart';

@Component({
  imports: [EChart],
  template: `@if (shown()) {
    <app-echart [options]="options()" label="Skill usage chart" />
  }`,
})
class Host {
  options = signal<object>({ series: [{ type: 'line', data: [1, 2] }] });
  shown = signal(true);
}

describe('EChart', () => {
  let chart: {
    setOption: ReturnType<typeof vi.fn<(o: unknown, opts?: unknown) => void>>;
    resize: ReturnType<typeof vi.fn<() => void>>;
    dispose: ReturnType<typeof vi.fn<() => void>>;
  };
  let init: ReturnType<
    typeof vi.fn<(el: HTMLElement, theme?: null, opts?: object) => ChartInstance>
  >;
  let observed: (() => void) | undefined;

  beforeEach(() => {
    chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
    init = vi.fn(() => chart as ChartInstance);
    observed = undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observed = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      providers: [{ provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init }) }],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('creates the chart in an accessible container and sets the options', async () => {
    const { el } = await render();
    const box = $(el, '.chart');
    expect(box.getAttribute('role')).toBe('img');
    expect(box.getAttribute('aria-label')).toBe('Skill usage chart');
    expect(init).toHaveBeenCalledWith(box, null, { renderer: 'canvas' });
    expect(chart.setOption).toHaveBeenCalledWith(
      { series: [{ type: 'line', data: [1, 2] }] },
      { notMerge: true },
    );
  });

  it('applies new options when they change', async () => {
    const { fixture } = await render();
    fixture.componentInstance.options.set({ series: [] });
    await fixture.whenStable();
    expect(chart.setOption).toHaveBeenLastCalledWith({ series: [] }, { notMerge: true });
  });

  it('resizes with its container and disposes the chart when removed', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const { fixture } = await render();
    // Resizing inside the observer callback can make the browser report a "ResizeObserver
    // loop" error: the chart resizes on the next frame instead, once however many changes.
    observed?.();
    observed?.();
    expect(chart.resize).not.toHaveBeenCalled();
    frames.splice(0).forEach((frame) => frame(0));
    expect(chart.resize).toHaveBeenCalledOnce();
    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it('emits chart clicks, for drill-down', async () => {
    const handlers = new Map<string, (params: unknown) => void>();
    const clickable = {
      ...chart,
      on: vi.fn((event: string, handler: (params: unknown) => void) =>
        handlers.set(event, handler),
      ),
    };
    init.mockReturnValue(clickable as ChartInstance);
    const fixture = TestBed.createComponent(EChart);
    fixture.componentRef.setInput('options', { series: [] });
    fixture.componentRef.setInput('label', 'Graph');
    const clicks = vi.fn();
    fixture.componentInstance.chartClick.subscribe(clicks);
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();

    handlers.get('click')?.({ dataType: 'node', data: { id: 'skill:x' } });
    expect(clicks).toHaveBeenCalledWith({ dataType: 'node', data: { id: 'skill:x' } });
  });
});
