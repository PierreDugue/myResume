import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { page, pageAccessGuard } from './layout/page-access.guard';
import { Shell } from './layout/shell/shell';

export const appRoutes: Route[] = [
  {
    path: '',
    component: Shell,
    // Waits (briefly) for the site preferences, then keeps visitors off disabled pages (`data.page`).
    canActivateChild: [pageAccessGuard],
    children: [
      {
        path: '',
        title: 'Career Overview',
        data: page('overview'),
        loadComponent: () => import('./public/overview/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'explore',
        title: 'Explore',
        data: page('explore'),
        loadComponent: () => import('./public/explore/explore-page').then((m) => m.ExplorePage),
      },
      {
        path: 'traces',
        title: 'Traces',
        data: page('traces'),
        loadComponent: () =>
          import('./public/traces/trace-search-page').then((m) => m.TraceSearchPage),
      },
      {
        path: 'traces/:slug',
        title: 'Trace',
        data: page('traces'),
        loadComponent: () => import('./public/traces/trace-page').then((m) => m.TracePage),
      },
      {
        path: 'service-map',
        title: 'Service map',
        data: page('serviceMap'),
        loadComponent: () =>
          import('./public/service-map/service-map-page').then((m) => m.ServiceMapPage),
      },
      {
        path: 'dashboards/quality',
        title: 'This codebase, observed',
        data: page('quality'),
        loadComponent: () => import('./public/quality/quality-page').then((m) => m.QualityPage),
      },
      {
        path: 'resume',
        title: 'Plain view',
        loadComponent: () =>
          import('./public/plain-resume/plain-resume-page').then((m) => m.PlainResumePage),
      },
      {
        path: 'about-this-site',
        title: 'About this site',
        data: page('about'),
        loadComponent: () => import('./public/about/about-page').then((m) => m.AboutPage),
      },
      {
        path: 'admin/login',
        title: 'Sign in',
        canActivate: [guestGuard],
        loadComponent: () => import('./admin/login/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'admin',
        // Child check too: the session can end while the admin moves between admin pages.
        canActivateChild: [authGuard],
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
