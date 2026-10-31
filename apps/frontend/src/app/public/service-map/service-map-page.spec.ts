import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import type { ServiceMapResponse } from '@my-resume/api-models';
import { renderRoute } from '../../admin/testing/render';
import { ServiceMapApi } from '../../core/service-map/service-map-api.service';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { fakePageAccess } from '../../layout/testing/fake-page-access';
import type { PublicPageId } from '@my-resume/api-models';
import { $ } from '../../testing';
import { ServiceMapPage } from './service-map-page';
import { serviceMapFixture } from './testing/service-map-fixture';

@Component({ template: 'elsewhere' })
class Elsewhere {}

describe('ServiceMapPage', () => {
  let respond: () => Observable<ServiceMapResponse>;
  let clickHandler: ((params: unknown) => void) | undefined;
  const chart = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn((_e: string, handler: (params: unknown) => void) => (clickHandler = handler)),
  };
  let disabled: PublicPageId[] = [];
  const render = () =>
    renderRoute(
      '/service-map',
      [
        { path: 'service-map', component: ServiceMapPage },
        { path: '**', component: Elsewhere },
      ],
      [
        { provide: ServiceMapApi, useValue: { get: () => respond() } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
        fakePageAccess(disabled),
      ],
    );

  beforeEach(() => {
    disabled = [];
    respond = () => of(serviceMapFixture());
  });

  it('draws the graph', async () => {
    const { el, settle } = await render();
    await settle();
    expect(el.querySelectorAll('app-echart')).toHaveLength(1);
    expect(chart.setOption).toHaveBeenCalled();
  });

  it('opens the view behind a node when it is clicked', async () => {
    const { router, settle } = await render();
    await settle();
    clickHandler?.({ dataType: 'node', data: { id: 'skill:sk-ngrx' } });
    await settle();
    expect(router.url).toBe('/?skill=ngrx');
  });

  it('ignores clicks on edges', async () => {
    const { router, settle } = await render();
    await settle();
    clickHandler?.({ dataType: 'edge', data: { source: 'job:e-kx', target: 'skill:sk-ngrx' } });
    await settle();
    expect(router.url).toBe('/service-map');
  });

  it('offers the graph as a table, with the same links', async () => {
    const { el, settle } = await render();
    $<HTMLButtonElement>(el, 'button[aria-haspopup="menu"]').click();
    await settle();
    [...el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.includes('table'))
      ?.click();
    await settle();
    const rows = [...el.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((c) => c.textContent?.replace(/\s+/g, ' ').trim()),
    );
    expect(rows).toEqual([
      ['Whoz', 'Job', '0.5', 'Angular, Claude'],
      ['KX', 'Job', '3.3', 'Angular, NgRx'],
      ['Pierre O11y', 'Project', '0.1', 'Angular'],
      ['Angular', 'Technology', '9', 'Whoz, KX, Pierre O11y'],
      ['NgRx', 'Technology', '3.3', 'KX'],
      ['Claude', 'Technology', '0.5', 'Whoz'],
    ]);
    expect(el.querySelector('tbody tr:nth-child(4) a')?.getAttribute('href')).toBe(
      '/?skill=angular',
    );
    expect(el.querySelector('tbody tr:nth-child(2) a')?.getAttribute('href')).toBe(
      '/explore?query=%7Bcompany%3D%22KX%22%7D',
    );
  });

  it('shows an error', async () => {
    respond = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    const { el } = await render();
    expect($(el, '[role="alert"]').textContent).toContain('could not be loaded');
  });

  describe('when a target page is hidden from the viewer', () => {
    it('ignores a click on a node that leads there, and still opens the others', async () => {
      disabled = ['traces'];
      const { router, settle } = await render();
      await settle();
      clickHandler?.({ dataType: 'node', data: { id: 'project:p-site' } });
      await settle();
      expect(router.url).toBe('/service-map');

      clickHandler?.({ dataType: 'node', data: { id: 'skill:sk-ngrx' } });
      await settle();
      expect(router.url).toBe('/?skill=ngrx');
    });

    it('shows the node as plain text in the table', async () => {
      disabled = ['traces', 'explore'];
      const { el, settle } = await render();
      $<HTMLButtonElement>(el, 'button[aria-haspopup="menu"]').click();
      await settle();
      [...el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
        .find((b) => b.textContent?.includes('table'))
        ?.click();
      await settle();
      const firstCell = (n: number) => $(el, `tbody tr:nth-child(${n}) th`);
      // Jobs lead to Explore, the project to Traces: both hidden, with their names still shown.
      expect(firstCell(1).querySelector('a')).toBeNull();
      expect(firstCell(1).textContent?.trim()).toBe('Whoz');
      expect(firstCell(3).querySelector('a')).toBeNull();
      expect(firstCell(3).textContent?.trim()).toBe('Pierre O11y');
      expect(firstCell(4).querySelector('a')?.getAttribute('href')).toBe('/?skill=angular');
    });
  });
});
