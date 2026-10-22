import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const LOGIN_URL = '/api/auth/login';

/**
 * Adds `Authorization: Bearer <token>` to our own API calls (relative `/api/...` URLs only, never to
 * other hosts). When the API rejects the token (401), signs out and opens the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const withToken = token !== null && req.url.startsWith('/api/') && req.url !== LOGIN_URL;
  const request = withToken ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (withToken && error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigate(['/admin/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
