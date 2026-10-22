import { Route } from '@angular/router';
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
        path: 'resume',
        title: 'Plain view',
        loadComponent: () =>
          import('./public/plain-resume/plain-resume-page').then((m) => m.PlainResumePage),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
