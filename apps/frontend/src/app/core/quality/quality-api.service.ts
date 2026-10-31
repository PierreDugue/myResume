import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { QualityReport } from '@my-resume/api-models';
import { Observable, catchError, of, throwError } from 'rxjs';

/** `GET /api/quality` (docs/api-contract.md, Quality). */
@Service()
export class QualityApi {
  private readonly http = inject(HttpClient);

  /** The build's report, or `null` when this build has none (a 404 is a normal state). */
  get(): Observable<QualityReport | null> {
    return this.http
      .get<QualityReport>('/api/quality')
      .pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404
            ? of(null)
            : throwError(() => error),
        ),
      );
  }
}
