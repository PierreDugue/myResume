import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import type { Trace } from '@my-resume/api-models';
import { renderRoute } from '../../admin/testing/render';
import { TracesApi } from '../../core/traces/traces-api.service';
import { $ } from '../../testing';
import { TracePage } from './trace-page';
import { traceFixture } from './testing/traces-fixture';

describe('TracePage', () => {
  let respond: (slug: string) => Observable<Trace>;
  const get = vi.fn((slug: string) => respond(slug));
  const render = (url = '/traces/pierre-o11y') =>
    renderRoute(
      url,
      [{ path: 'traces/:slug', component: TracePage }],
      [{ provide: TracesApi, useValue: { get } }],
    );

  beforeEach(() => {
    respond = () => of(traceFixture());
    get.mockClear();
  });

  it('loads the trace of the project in the URL and draws its waterfall', async () => {
    const { el } = await render();
    expect(get).toHaveBeenCalledWith('pierre-o11y');
    expect($(el, 'h2').textContent).toContain('Pierre O11y');
    expect(el.textContent).toContain('This site.');
    expect(el.textContent).toContain('3 spans');
    expect(el.querySelectorAll('app-waterfall li.row')).toHaveLength(4);
    expect($<HTMLAnchorElement>(el, 'a.website').getAttribute('href')).toBe('https://example.com');
    expect($<HTMLAnchorElement>(el, 'a.back').getAttribute('href')).toBe('/traces');
  });

  it('offers the spans as a table too', async () => {
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
    expect(rows[3]).toEqual(['Auth', 'Oct 22, 2026', 'Oct 22, 2026', '1 day', 'NestJS']);
  });

  it('says when the project has no trace', async () => {
    respond = () => throwError(() => new HttpErrorResponse({ status: 404 }));
    const { el } = await render('/traces/nope');
    expect($(el, '[role="alert"]').textContent).toContain('No trace for this project');
  });
});
