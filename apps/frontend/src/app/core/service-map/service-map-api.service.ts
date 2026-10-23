import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { ServiceMapResponse } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `GET /api/service-map` (docs/api-contract.md, Service map). */
@Service()
export class ServiceMapApi {
  private readonly http = inject(HttpClient);

  get(): Observable<ServiceMapResponse> {
    return this.http.get<ServiceMapResponse>('/api/service-map');
  }
}
