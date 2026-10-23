import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const LOGIN_URL = '/api/auth/login';

/**
 * Adds `Authorization: Bearer <token>` to our own API calls (relative `/api/...` URLs only, never to
 * other hosts). When our API answers 401, signs out and opens the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const ownApi = req.url.startsWith('/api/') && req.url !== LOGIN_URL;
  const withToken = token !== null && ownApi;
  const request = withToken ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Also without a token: the session may have ended before this call (public routes never 401).
      if (ownApi && error instanceof HttpErrorResponse && error.status === 401) {
        if (withToken) auth.logout();
        void router.navigate(['/admin/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
