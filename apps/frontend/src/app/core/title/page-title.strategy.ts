import { EnvironmentProviders, Provider, Service, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_NAME } from '../app-name';

/**
 * Sets the document title from the route `title` ("Career Overview · Pierre O11y") and exposes the
 * current page title as a signal for the breadcrumb.
 */
@Service()
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly current = signal(APP_NAME);
  readonly pageTitle = this.current.asReadonly();

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.current.set(page ?? APP_NAME);
    this.title.setTitle(page ? `${page} · ${APP_NAME}` : APP_NAME);
  }
}

/** Registers {@link PageTitleStrategy} as the router's title strategy (a single shared instance). */
export function providePageTitleStrategy(): Provider | EnvironmentProviders {
  return { provide: TitleStrategy, useExisting: PageTitleStrategy };
}
