import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { historyOf, samplesBetween, tsAt } from '../../public/site-metrics/testing/process-fixture';
import { SiteMetricsApi } from './site-metrics-api.service';

describe('SiteMetricsApi', () => {
  let http: HttpTestingController;
  let api: SiteMetricsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(SiteMetricsApi);
  });
  afterEach(() => http.verify());

  it('loads the whole buffer with GET /api/site-metrics/process and no parameter', async () => {
    const result = firstValueFrom(api.processHistory());
    const req = http.expectOne('/api/site-metrics/process');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(historyOf(samplesBetween(0, 2)));
    expect((await result).samples).toHaveLength(3);
  });

  it('sends since as a query parameter when it is set', async () => {
    const since = tsAt(10);
    const result = firstValueFrom(api.processHistory(since));
    const req = http.expectOne((r) => r.url === '/api/site-metrics/process');
    expect(req.request.params.keys()).toEqual(['since']);
    expect(req.request.params.get('since')).toBe(since);
    req.flush(historyOf([]));
    expect((await result).samples).toEqual([]);
  });

  it('lets errors through, such as the 404 of a disabled page', async () => {
    const result = firstValueFrom(api.processHistory());
    http
      .expectOne('/api/site-metrics/process')
      .flush({ statusCode: 404 }, { status: 404, statusText: 'Not Found' });
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});
