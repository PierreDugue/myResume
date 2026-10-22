import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Admin frame: a tab bar over every admin page. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Admin sections">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: tab.exact }"
          ariaCurrentWhenActive="page"
          >{{ tab.label }}</a
        >
      }
    </nav>
    <router-outlet />
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--space-1);
      margin-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
      overflow-x: auto;
    }
    a {
      padding: var(--space-2) var(--space-3);
      border-bottom: 2px solid transparent;
      color: var(--color-text-muted);
      text-decoration: none;
      white-space: nowrap;
    }
    a:hover {
      color: var(--color-text);
    }
    a.active {
      border-bottom-color: var(--color-accent);
      color: var(--color-text);
    }
  `,
})
export class AdminLayout {
  protected readonly tabs = [
    { label: 'Overview', path: '/admin', exact: true },
    { label: 'Profile', path: '/admin/profile', exact: false },
    { label: 'Skills', path: '/admin/skills', exact: false },
    { label: 'Experience', path: '/admin/experiences', exact: false },
    { label: 'Education', path: '/admin/education', exact: false },
    { label: 'Projects', path: '/admin/projects', exact: false },
  ];
}
