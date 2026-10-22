import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiStatusService } from '../../core/api/api-status.service';
import { APP_NAME } from '../../core/app-name';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { PageTitleStrategy } from '../../core/title/page-title.strategy';
import { NAV_ITEMS } from '../nav-items';

const API_STATUS_POLL_MS = 30_000;

/** App layout: sidebar (brand, navigation, API status), top bar (breadcrumb, actions) and content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly appName = APP_NAME;
  protected readonly navItems = NAV_ITEMS;
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly pageTitle = inject(PageTitleStrategy).pageTitle;
  protected readonly apiStatus = inject(ApiStatusService).status;
  protected readonly sidebarOpen = signal(false);

  constructor() {
    inject(ApiStatusService).startPolling(API_STATUS_POLL_MS);
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sidebarOpen.set(false));
  }

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }
}
