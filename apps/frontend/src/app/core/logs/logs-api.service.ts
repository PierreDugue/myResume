import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { LogLabel, LogsQuery, LogsResponse } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET /api/logs` and `GET /api/logs/labels` (docs/api-contract.md, Explore). */
@Service()
export class LogsApi {
  private readonly http = inject(HttpClient);

  search(query: LogsQuery): Observable<LogsResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<LogsResponse>('/api/logs', { params });
  }

  labels(): Observable<LogLabel[]> {
    return this.http.get<LogLabel[]>('/api/logs/labels');
  }
}
