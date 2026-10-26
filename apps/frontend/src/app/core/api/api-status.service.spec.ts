import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { HealthResponse } from '@my-resume/api-models';
import { ApiStatusService } from './api-status.service';

const up: HealthResponse = {
  status: 'ok',
  info: { database: { status: 'up' } },
  error: {},
  details: { database: { status: 'up' } },
};
const down: HealthResponse = {
  status: 'error',
  info: {},
  error: { database: { status: 'down', message: 'timeout' } },
  details: { database: { status: 'down', message: 'timeout' } },
};

describe('ApiStatusService', () => {
  let service: ApiStatusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiStatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('starts as "unknown" before the first check', () => {
    expect(service.status()).toBe('unknown');
  });

  it('calls GET /api/health and reports "up" when the API answers ok', () => {
    service.refresh();
    const req = http.expectOne('/api/health');
    expect(req.request.method).toBe('GET');
    req.flush(up);
    expect(service.status()).toBe('up');
  });

  it('reports "down" when the API answers 503', () => {
    service.refresh();
    http.expectOne('/api/health').flush(down, { status: 503, statusText: 'Service Unavailable' });
    expect(service.status()).toBe('down');
  });

  it('reports "down" when the API cannot be reached', () => {
    service.refresh();
    http.expectOne('/api/health').error(new ProgressEvent('error'));
    expect(service.status()).toBe('down');
  });

  it('polls immediately and then at the given interval', () => {
    vi.useFakeTimers();
    service.startPolling(30_000);

    http.expectOne('/api/health').flush(up);
    expect(service.status()).toBe('up');

    vi.advanceTimersByTime(30_000);
    http.expectOne('/api/health').flush(down, { status: 503, statusText: 'Service Unavailable' });
    expect(service.status()).toBe('down');
  });

  it('does not start a second polling loop when called twice', () => {
    vi.useFakeTimers();
    service.startPolling(30_000);
    service.startPolling(30_000);
    expect(http.match('/api/health')).toHaveLength(1);
  });

  describe('cold start (the hosting platform wakes a sleeping backend)', () => {
    const proxyPage = '<html><body>Bad Gateway</body></html>';

    beforeEach(() => vi.useFakeTimers());

    it('reports "starting" while the health check takes more than 3 seconds, then "up"', () => {
      service.refresh();
      const req = http.expectOne('/api/health');

      vi.advanceTimersByTime(2_999);
      expect(service.status()).toBe('unknown');
      vi.advanceTimersByTime(1);
      expect(service.status()).toBe('starting');

      req.flush(up);
      expect(service.status()).toBe('up');
    });

    it('does not report "starting" once a quick answer has arrived', () => {
      service.refresh();
      http.expectOne('/api/health').flush(up);
      vi.advanceTimersByTime(10_000);
      expect(service.status()).toBe('up');
    });

    it.each([502, 503, 504])(
      'reports "starting" for a %i from the platform or proxy (no health report)',
      (status) => {
        service.refresh();
        http.expectOne('/api/health').flush(proxyPage, { status, statusText: 'Proxy error' });
        expect(service.status()).toBe('starting');
      },
    );

    it('still reports "down" for a 503 health report from the backend itself', () => {
      service.refresh();
      http.expectOne('/api/health').flush(down, { status: 503, statusText: 'Service Unavailable' });
      expect(service.status()).toBe('down');
    });

    it('reports "down" for other errors, such as a 500', () => {
      service.refresh();
      http.expectOne('/api/health').flush(proxyPage, { status: 500, statusText: 'Error' });
      expect(service.status()).toBe('down');
    });

    it('checks every 5 seconds while starting, then goes back to the normal interval', () => {
      service.startPolling(30_000);
      http.expectOne('/api/health').flush(proxyPage, { status: 502, statusText: 'Bad Gateway' });
      expect(service.status()).toBe('starting');

      vi.advanceTimersByTime(4_999);
      http.expectNone('/api/health');
      vi.advanceTimersByTime(1);
      http.expectOne('/api/health').flush(up);
      expect(service.status()).toBe('up');

      vi.advanceTimersByTime(5_000);
      http.expectNone('/api/health');
      vi.advanceTimersByTime(25_000);
      http.expectOne('/api/health').flush(up);
    });

    it('reports "down" after 2 minutes of starting, and "up" again once the API answers', () => {
      service.startPolling(30_000);
      http.expectOne('/api/health').flush(proxyPage, { status: 503, statusText: 'Unavailable' });

      // Starting at 0 s, then a check every 5 s: still within 2 minutes at 115 s.
      for (let t = 5_000; t <= 115_000; t += 5_000) {
        vi.advanceTimersByTime(5_000);
        http.expectOne('/api/health').flush(proxyPage, { status: 503, statusText: 'Unavailable' });
      }
      expect(service.status()).toBe('starting');

      vi.advanceTimersByTime(5_000);
      http.expectOne('/api/health').flush(proxyPage, { status: 503, statusText: 'Unavailable' });
      expect(service.status()).toBe('down');

      // Back to the normal interval once down.
      vi.advanceTimersByTime(30_000);
      http.expectOne('/api/health').flush(up);
      expect(service.status()).toBe('up');
    });
  });
});
