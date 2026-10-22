import { Route } from '@angular/router';

/** Admin pages, all behind `authGuard` (see app.routes.ts). */
export const adminRoutes: Route[] = [
  {
    path: '',
    title: 'Admin',
    loadComponent: () => import('./admin-home/admin-home-page').then((m) => m.AdminHomePage),
  },
];
