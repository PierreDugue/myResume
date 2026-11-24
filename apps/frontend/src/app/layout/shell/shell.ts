import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiStatusService } from '../../core/api/api-status.service';
import { APP_NAME } from '../../core/app-name';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { PageTitleStrategy } from '../../core/title/page-title.strategy';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import { showsAssistant } from '../assistant-visibility';
import { AssistantPanel } from '../../public/assistant/assistant-panel';
import { NAV_ITEMS } from '../nav-items';
import { PageAccess } from '../page-access';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- polling temporarily disabled (see constructor)
const API_STATUS_POLL_MS = 30_000;

/** App layout: sidebar (brand, navigation, API status), top bar (breadcrumb, actions) and content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AssistantPanel],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '[class.assistant-open]': 'assistantVisible() && assistantOpen()' },
})
export class Shell {
  protected readonly appName = APP_NAME;
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly access = inject(PageAccess);
  /** The pages this viewer may open: visitors don't see the ones the admin disabled. */
  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => this.access.canView(item.page)),
  );
  protected readonly pageTitle = inject(PageTitleStrategy).pageTitle;
  protected readonly apiStatus = inject(ApiStatusService).status;
  protected readonly sidebarOpen = signal(false);

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly preferences = inject(SitePreferencesStore).preferences;
  private readonly assistantToggleButton = viewChild<ElementRef<HTMLElement>>('assistantToggle');
  private readonly currentUrl = signal(this.router.url);
  protected readonly assistantVisible = computed(() =>
    showsAssistant(this.preferences(), this.currentUrl()),
  );
  /** Closed again whenever the assistant goes away (admin page, switched off), so it never comes back open. */
  protected readonly assistantOpen = linkedSignal({
    source: this.assistantVisible,
    computation: () => false,
  });
  /** The panel is loaded (`@defer`) the first time it is opened, then only hidden and shown. */
  protected readonly assistantOpened = linkedSignal({
    source: this.assistantVisible,
    computation: () => false,
  });

  constructor() {
    // Temporarily disabled: checking whether this polling (GET /api/health pings the database) is
    // what keeps Neon awake. To restore: inject(ApiStatusService).startPolling(API_STATUS_POLL_MS);
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.sidebarOpen.set(false);
        this.currentUrl.set(e.urlAfterRedirects);
      });
  }

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  protected toggleAssistant(): void {
    if (this.assistantOpen()) {
      this.closeAssistant();
      return;
    }
    this.assistantOpen.set(true);
    if (this.assistantOpened()) {
      // Reopened: the panel exists already, so put the cursor back in its question field.
      afterNextRender(
        () =>
          this.host.nativeElement.querySelector<HTMLElement>('#assistant-panel textarea')?.focus(),
        { injector: this.injector },
      );
    }
    this.assistantOpened.set(true);
  }

  protected closeAssistant(): void {
    this.assistantOpen.set(false);
    this.assistantToggleButton()?.nativeElement.focus();
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }
}
