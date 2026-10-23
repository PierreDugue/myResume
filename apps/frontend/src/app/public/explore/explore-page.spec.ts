import { HttpErrorResponse } from '@angular/common/http';
import type { LogsQuery, LogsResponse } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { renderRoute, type } from '../../admin/testing/render';
import { LogsApi } from '../../core/logs/logs-api.service';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { $ } from '../../testing';
import { ExplorePage } from './explore-page';
import { LABELS_FIXTURE, logsFixture } from './testing/logs-fixture';

describe('ExplorePage', () => {
  let respond: (q: LogsQuery) => Observable<LogsResponse>;
  const search = vi.fn((q: LogsQuery) => respond(q));
  const labels = vi.fn(() => of(LABELS_FIXTURE));
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };

  const render = (url = '/explore') =>
    renderRoute(
      url,
      [{ path: 'explore', component: ExplorePage }],
      [
        { provide: LogsApi, useValue: { search, labels } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
      ],
    );
  const queryInput = (el: HTMLElement) => $<HTMLInputElement>(el, 'input[role="combobox"]');
  const select = (el: HTMLElement, label: string) => {
    const l = [...el.querySelectorAll('label')].find((x) => x.textContent?.trim() === label);
    return $<HTMLSelectElement>(el, `#${l?.getAttribute('for')}`);
  };

  beforeEach(() => {
    respond = () => of(logsFixture());
    search.mockClear();
  });

  it('searches with the query and years in the URL', async () => {
    const { el } = await render('/explore?query=%7Bcompany%3D%22KX%22%7D&from=2020');
    expect(search).toHaveBeenCalledWith({ query: '{company="KX"}', from: 2020 });
    expect(queryInput(el).value).toBe('{company="KX"}');
  });

  it('shows the matching lines, their count and the log volume chart', async () => {
    const { el } = await render();
    expect(el.querySelectorAll('app-log-list li.line')).toHaveLength(3);
    expect($(el, '.logs-panel').textContent).toContain('3 lines');
    expect(el.querySelectorAll('app-echart')).toHaveLength(1);
  });

  it('offers the log volume as a table too', async () => {
    const { el, settle } = await render();
    $<HTMLButtonElement>(el, '.volume-panel button[aria-haspopup="menu"]').click();
    await settle();
    const toggle = [
      ...el.querySelectorAll<HTMLButtonElement>('.volume-panel [role="menuitem"]'),
    ].find((b) => b.textContent?.includes('table'));
    toggle?.click();
    await settle();
    const rows = [...el.querySelectorAll('.volume-panel tbody tr')].map((tr) =>
      [...tr.children].map((c) => c.textContent?.trim()),
    );
    expect(rows[0]).toEqual(['2024', '1', '0', '1', '0', '0']);
  });

  it('runs a query by writing it into the URL', async () => {
    const { el, router, settle } = await render('/explore?from=2020');
    const input = queryInput(el);
    input.value = '{type="education"}';
    input.dispatchEvent(new Event('input'));
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(router.url).toBe('/explore?query=%7Btype%3D%22education%22%7D&from=2020');
    expect(search).toHaveBeenLastCalledWith({ query: '{type="education"}', from: 2020 });
  });

  it('runs an example query', async () => {
    const { el, router, settle } = await render();
    const example = $<HTMLButtonElement>(el, '.examples button');
    example.click();
    await settle();
    expect(router.url).toContain('query=');
    expect(search).toHaveBeenLastCalledWith({ query: example.textContent?.trim() });
  });

  it('narrows the query from a line label', async () => {
    const { el, router, settle } = await render('/explore?query=%7Btype%3D%22experience%22%7D');
    $<HTMLButtonElement>(el, 'li.line:nth-child(2) button.summary').click();
    await settle();
    $<HTMLButtonElement>(el, 'button[aria-label="Filter for company=KX"]').click();
    await settle();
    expect(search).toHaveBeenLastCalledWith({ query: '{type="experience", company="KX"}' });
    expect(router.url).toContain('company');
  });

  it('writes a new year range into the URL', async () => {
    const { el, router, settle } = await render();
    expect([...select(el, 'From').options].map((o) => o.value)[0]).toBe('2011');
    expect(select(el, 'From').value).toBe('2024');
    type(select(el, 'From'), '2025');
    await settle();
    expect(router.url).toBe('/explore?from=2025&to=2026');
    expect(search).toHaveBeenLastCalledWith({ from: 2025, to: 2026 });
  });

  it('suggests labels from GET /api/logs/labels', async () => {
    const { el, settle } = await render();
    const input = queryInput(el);
    input.value = '{t';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input'));
    await settle();
    expect([...el.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())).toEqual([
      'type',
      'tech',
    ]);
  });

  it('shows the error of a query the server refuses', async () => {
    respond = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: ['Regular expression not allowed: no back-references (column 4)'] },
          }),
      );
    const { el } = await render('/explore?query=x');
    expect($(el, '[role="alert"]').textContent).toContain('no back-references (column 4)');
  });

  it('offers to retry when the logs cannot be loaded', async () => {
    respond = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    const { el, settle } = await render();
    expect(el.textContent).toContain('The logs could not be loaded');
    respond = () => of(logsFixture());
    $<HTMLButtonElement>(el, 'button.retry').click();
    await settle();
    expect(el.querySelectorAll('app-log-list li.line')).toHaveLength(3);
  });
});
