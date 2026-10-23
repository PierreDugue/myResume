import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { DashboardQuery, DashboardResponse } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET /api/dashboard` (docs/api-contract.md, Dashboard). */
@Service()
export class DashboardApi {
  private readonly http = inject(HttpClient);

  get(query: DashboardQuery): Observable<DashboardResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    }
    return this.http.get<DashboardResponse>('/api/dashboard', { params });
  }
}
