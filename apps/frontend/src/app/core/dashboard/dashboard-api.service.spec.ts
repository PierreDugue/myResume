import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { dashboardFixture } from '../../public/overview/testing/dashboard-fixture';
import { DashboardApi } from './dashboard-api.service';

describe('DashboardApi', () => {
  let http: HttpTestingController;
  let api: DashboardApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(DashboardApi);
  });
  afterEach(() => http.verify());

  it('calls GET /api/dashboard with only the parameters that are set', async () => {
    const result = firstValueFrom(api.get({ from: 2017, skill: 'angular' }));
    const req = http.expectOne((r) => r.url === '/api/dashboard');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['from', 'skill']);
    expect(req.request.params.get('from')).toBe('2017');
    req.flush(dashboardFixture());
    expect((await result).range).toEqual({ from: 2011, to: 2026 });
  });

  it('sends no parameters for the default view', () => {
    api.get({}).subscribe();
    const req = http.expectOne('/api/dashboard');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(dashboardFixture());
  });
});
