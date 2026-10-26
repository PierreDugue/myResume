import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { apiRetryInterceptor } from './api-retry.interceptor';

/** Delays between tries: 2, 4, 8 s, then 15 s, about 90 s in all. */
const DELAYS = [2_000, 4_000, 8_000, 15_000, 15_000, 15_000, 15_000, 15_000];

describe('apiRetryInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiRetryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function call<T>(request: Observable<T>) {
    const result: { value?: T; error?: HttpErrorResponse } = {};
    request.subscribe({
      next: (value) => (result.value = value),
      error: (error: HttpErrorResponse) => (result.error = error),
    });
    return result;
  }

  const fail = (url: string, status: number) =>
    http.expectOne(url).flush('<html>proxy error</html>', { status, statusText: 'Error' });

  it.each([502, 503, 504])('retries a GET /api call that failed with %i', (status) => {
    const result = call(client.get('/api/resume'));
    fail('/api/resume', status);

    vi.advanceTimersByTime(2_000);
    http.expectOne('/api/resume').flush({ ok: true });

    expect(result.value).toEqual({ ok: true });
    expect(result.error).toBeUndefined();
  });

  it('waits longer between each try', () => {
    call(client.get('/api/resume'));
    fail('/api/resume', 502);

    vi.advanceTimersByTime(1_999);
    http.expectNone('/api/resume');
    vi.advanceTimersByTime(1);
    fail('/api/resume', 502);

    vi.advanceTimersByTime(3_999);
    http.expectNone('/api/resume');
    vi.advanceTimersByTime(1);
    fail('/api/resume', 502);

    vi.advanceTimersByTime(7_999);
    http.expectNone('/api/resume');
    vi.advanceTimersByTime(1);
    http.expectOne('/api/resume').flush({ ok: true });
  });

  it('gives up after about 90 seconds and reports the last error', () => {
    const result = call(client.get('/api/resume'));
    fail('/api/resume', 503);
    for (const delay of DELAYS) {
      vi.advanceTimersByTime(delay);
      fail('/api/resume', 503);
    }
    expect(DELAYS.reduce((a, b) => a + b)).toBe(89_000);

    vi.advanceTimersByTime(60_000);
    http.expectNone('/api/resume');
    expect(result.error?.status).toBe(503);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never retries a %s (no double writes)', (method) => {
    const result = call(client.request(method, '/api/skills', { body: {} }));
    fail('/api/skills', 503);

    vi.advanceTimersByTime(120_000);
    http.expectNone('/api/skills');
    expect(result.error?.status).toBe(503);
  });

  it.each([400, 401, 404, 500])('does not retry a %i, which waiting would not fix', (status) => {
    const result = call(client.get('/api/resume'));
    fail('/api/resume', status);

    vi.advanceTimersByTime(120_000);
    http.expectNone('/api/resume');
    expect(result.error?.status).toBe(status);
  });

  it('does not retry when the site itself cannot be reached (network error)', () => {
    const result = call(client.get('/api/resume'));
    http.expectOne('/api/resume').error(new ProgressEvent('error'));

    vi.advanceTimersByTime(120_000);
    http.expectNone('/api/resume');
    expect(result.error?.status).toBe(0);
  });

  it('leaves GET /api/health alone: the API status service handles its own checks', () => {
    const result = call(client.get('/api/health'));
    fail('/api/health', 503);

    vi.advanceTimersByTime(120_000);
    http.expectNone('/api/health');
    expect(result.error?.status).toBe(503);
  });

  it('only retries our own API, not other URLs', () => {
    const result = call(client.get('https://example.com/data.json'));
    fail('https://example.com/data.json', 503);

    vi.advanceTimersByTime(120_000);
    http.expectNone('https://example.com/data.json');
    expect(result.error?.status).toBe(503);
  });
});
