import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { ProcessMetricsHistory } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET /api/site-metrics/process` (docs/api-contract.md, Site metrics). */
@Service()
export class SiteMetricsApi {
  private readonly http = inject(HttpClient);

  /**
   * The backend's buffered process samples (last 5 minutes, oldest first). With `since` (the `ts`
   * of the last sample the caller has), only the samples after it. A disabled page answers 404.
   */
  processHistory(since?: string): Observable<ProcessMetricsHistory> {
    const params = since ? new HttpParams().set('since', since) : undefined;
    return this.http.get<ProcessMetricsHistory>('/api/site-metrics/process', { params });
  }
}
