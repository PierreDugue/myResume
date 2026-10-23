import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import type { TraceSummary } from '@my-resume/api-models';
import { renderRoute } from '../../admin/testing/render';
import { TracesApi } from '../../core/traces/traces-api.service';
import { TraceSearchPage } from './trace-search-page';
import { traceSummariesFixture } from './testing/traces-fixture';

describe('TraceSearchPage', () => {
  let respond: () => Observable<TraceSummary[]>;
  const render = () =>
    renderRoute(
      '/traces',
      [{ path: 'traces', component: TraceSearchPage }],
      [{ provide: TracesApi, useValue: { list: () => respond() } }],
    );
  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(() => (respond = () => of(traceSummariesFixture())));

  it('lists the traces in a table, each linking to its waterfall', async () => {
    const { el } = await render();
    const rows = [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map(text));
    expect(rows).toEqual([
      ['Pierre O11y', 'Oct 21, 2026', '4 days ongoing', '3', 'Angular, NestJS'],
      ['Childcare', 'Oct 1, 2025', '2 months', '0', '–'],
    ]);
    expect(el.querySelector('tbody a')?.getAttribute('href')).toBe('/traces/pierre-o11y');
    expect([...el.querySelectorAll('thead th')].map(text)).toEqual([
      'Project',
      'Start',
      'Duration',
      'Spans',
      'Technologies',
    ]);
  });

  it('shows an empty state', async () => {
    respond = () => of([]);
    const { el } = await render();
    expect(el.textContent).toContain('No traces yet');
  });

  it('shows an error', async () => {
    respond = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    const { el } = await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });
});
