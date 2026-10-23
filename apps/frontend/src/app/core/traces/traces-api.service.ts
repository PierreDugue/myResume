import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Trace, TraceSummary } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET /api/traces` and `GET /api/traces/:slug` (docs/api-contract.md, Traces). */
@Service()
export class TracesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<TraceSummary[]> {
    return this.http.get<TraceSummary[]>('/api/traces');
  }

  get(slug: string): Observable<Trace> {
    return this.http.get<Trace>(`/api/traces/${encodeURIComponent(slug)}`);
  }
}
