import { Route } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminListPage } from './list/admin-list-page';
import { EDUCATION_LIST, EXPERIENCES_LIST, PROJECTS_LIST, SKILLS_LIST } from './list/list-configs';

/** Admin pages, all behind `authGuard` (see app.routes.ts), inside the admin tab layout. */
export const adminRoutes: Route[] = [
  {
    path: '',
    component: AdminLayout,
    children: [
      {
        path: '',
        title: 'Admin',
        loadComponent: () => import('./admin-home/admin-home-page').then((m) => m.AdminHomePage),
      },
      {
        path: 'profile',
        title: 'Profile',
        loadComponent: () => import('./profile/profile-page').then((m) => m.ProfilePage),
      },
      { path: 'skills', title: 'Skills', component: AdminListPage, data: { list: SKILLS_LIST } },
      {
        path: 'skills/:id',
        title: 'Edit skill',
        loadComponent: () => import('./skills/skill-edit-page').then((m) => m.SkillEditPage),
      },
      {
        path: 'experiences',
        title: 'Experience',
        component: AdminListPage,
        data: { list: EXPERIENCES_LIST },
      },
      {
        path: 'experiences/:id',
        title: 'Edit experience',
        loadComponent: () =>
          import('./experiences/experience-edit-page').then((m) => m.ExperienceEditPage),
      },
      {
        path: 'education',
        title: 'Education',
        component: AdminListPage,
        data: { list: EDUCATION_LIST },
      },
      {
        path: 'education/:id',
        title: 'Edit education',
        loadComponent: () =>
          import('./education/education-edit-page').then((m) => m.EducationEditPage),
      },
      {
        path: 'projects',
        title: 'Projects',
        component: AdminListPage,
        data: { list: PROJECTS_LIST },
      },
      {
        path: 'projects/:id',
        title: 'Edit project',
        loadComponent: () => import('./projects/project-edit-page').then((m) => m.ProjectEditPage),
      },
    ],
  },
];
