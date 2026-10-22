/** Overall result of `GET /api/health`. */
export type HealthStatus = 'ok' | 'error' | 'shutting_down';

/** Result of one dependency check (e.g. `database`). */
export interface HealthCheckResult {
  status: 'up' | 'down';
  /** Ping duration in milliseconds (present when measured). */
  responseTime?: number;
  message?: string;
}

/** Response of `GET /api/health` (HTTP 200 when `ok`, 503 otherwise). */
export interface HealthResponse {
  status: HealthStatus;
  /** Checks that are up. */
  info?: Record<string, HealthCheckResult>;
  /** Checks that are down. */
  error?: Record<string, HealthCheckResult>;
  /** All checks. */
  details: Record<string, HealthCheckResult>;
}
