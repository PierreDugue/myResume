import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { appRoutes } from './app.routes';
import { apiRetryInterceptor } from './core/api/api-retry.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { providePageTitleStrategy } from './core/title/page-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Retry runs inside auth: retried calls keep the token, and auth only sees the final error.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, apiRetryInterceptor])),
    providePageTitleStrategy(),
  ],
};
