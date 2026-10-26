import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';

/** What the platform or nginx answer while a sleeping backend wakes up (a cold start). */
const PROXY_ERRORS = [502, 503, 504];
/** Delays before each retry: 2, 4, 8 s, then 15 s. 89 s in all, enough for a cold start. */
const MAX_RETRIES = 8;
const FIRST_DELAY_MS = 2_000;
const MAX_DELAY_MS = 15_000;

/**
 * Retries our own API's `GET` calls that fail with 502, 503 or 504, with increasing delays, so
 * pages fill in by themselves once a sleeping backend is up (see docs/spec.md, Cold starts).
 * Writes are never retried: the first attempt may have reached the backend. `/api/health` is left
 * to ApiStatusService, which shows the cold start.
 */
export const apiRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const retryable =
    req.method === 'GET' && req.url.startsWith('/api/') && req.url !== '/api/health';
  if (!retryable) return next(req);

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: unknown, retryCount: number) =>
        error instanceof HttpErrorResponse && PROXY_ERRORS.includes(error.status)
          ? timer(Math.min(FIRST_DELAY_MS * 2 ** (retryCount - 1), MAX_DELAY_MS))
          : throwError(() => error),
    }),
  );
};
