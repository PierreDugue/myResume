import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { SitePreferences, UpdateSitePreferencesRequest } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET` / `PATCH /api/preferences` (docs/api-contract.md, Preferences). */
@Service()
export class PreferencesApi {
  private readonly http = inject(HttpClient);

  get(): Observable<SitePreferences> {
    return this.http.get<SitePreferences>('/api/preferences');
  }

  /** Partial update: only the keys sent change. Returns the complete preferences. */
  update(body: UpdateSitePreferencesRequest): Observable<SitePreferences> {
    return this.http.patch<SitePreferences>('/api/preferences', body);
  }
}
