import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { traceFixture, traceSummariesFixture } from '../../public/traces/testing/traces-fixture';
import { TracesApi } from './traces-api.service';

describe('TracesApi', () => {
  let http: HttpTestingController;
  let api: TracesApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TracesApi);
  });
  afterEach(() => http.verify());

  it('lists the traces with GET /api/traces', async () => {
    const result = firstValueFrom(api.list());
    http.expectOne('/api/traces').flush(traceSummariesFixture());
    expect((await result).map((t) => t.slug)).toEqual(['pierre-o11y', 'childcare']);
  });

  it('loads one trace with GET /api/traces/:slug, encoding the slug', async () => {
    const result = firstValueFrom(api.get('pierre-o11y'));
    http.expectOne('/api/traces/pierre-o11y').flush(traceFixture());
    expect((await result).spans).toHaveLength(4);

    api.get('a/b').subscribe({ error: () => undefined });
    http.expectOne('/api/traces/a%2Fb').flush(null, { status: 404, statusText: 'Not Found' });
  });
});
