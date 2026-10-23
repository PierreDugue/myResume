import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LABELS_FIXTURE, logsFixture } from '../../public/explore/testing/logs-fixture';
import { LogsApi } from './logs-api.service';

describe('LogsApi', () => {
  let http: HttpTestingController;
  let api: LogsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(LogsApi);
  });
  afterEach(() => http.verify());

  it('searches with GET /api/logs and only the parameters that are set', async () => {
    const result = firstValueFrom(api.search({ query: '{company="KX"}', from: 2020 }));
    const req = http.expectOne((r) => r.url === '/api/logs');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['from', 'query']);
    expect(req.request.params.get('query')).toBe('{company="KX"}');
    expect(req.request.params.get('from')).toBe('2020');
    req.flush(logsFixture());
    expect((await result).total).toBe(3);
  });

  it('sends no parameters for an empty query', () => {
    api.search({ query: '' }).subscribe();
    const req = http.expectOne('/api/logs');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(logsFixture());
  });

  it('loads the labels with GET /api/logs/labels', async () => {
    const result = firstValueFrom(api.labels());
    http.expectOne('/api/logs/labels').flush(LABELS_FIXTURE);
    expect((await result).map((l) => l.name)).toEqual(['type', 'level', 'company', 'tech']);
  });
});
