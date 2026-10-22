import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Admin pages: signed-in admin only; visitors go to the login page and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isAuthenticated() ||
  inject(Router).createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });

/** Login page: a signed-in admin goes straight to the admin home. */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/admin']);

/** Where to go after signing in: only a path of this site (prevents open redirects). */
export function safeReturnUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\'))
    return '/admin';
  return url;
}
