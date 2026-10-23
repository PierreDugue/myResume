import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { Shell } from './layout/shell/shell';

export const appRoutes: Route[] = [
  {
    path: '',
    component: Shell,
    children: [
      {
        path: '',
        title: 'Career Overview',
        loadComponent: () => import('./public/overview/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'explore',
        title: 'Explore',
        loadComponent: () => import('./public/explore/explore-page').then((m) => m.ExplorePage),
      },
      {
        path: 'traces',
        title: 'Traces',
        loadComponent: () =>
          import('./public/traces/trace-search-page').then((m) => m.TraceSearchPage),
      },
      {
        path: 'traces/:slug',
        title: 'Trace',
        loadComponent: () => import('./public/traces/trace-page').then((m) => m.TracePage),
      },
      {
        path: 'service-map',
        title: 'Service map',
        loadComponent: () =>
          import('./public/service-map/service-map-page').then((m) => m.ServiceMapPage),
      },
      {
        path: 'resume',
        title: 'Plain view',
        loadComponent: () =>
          import('./public/plain-resume/plain-resume-page').then((m) => m.PlainResumePage),
      },
      {
        path: 'admin/login',
        title: 'Sign in',
        canActivate: [guestGuard],
        loadComponent: () => import('./admin/login/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'admin',
        canActivate: [authGuard],
        loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
