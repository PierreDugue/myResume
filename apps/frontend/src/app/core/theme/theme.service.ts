import { DOCUMENT, Service, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'theme';

/**
 * Dark/light theme. Dark is the default; the choice is remembered in localStorage when available.
 * The theme is applied as `<html data-theme="...">`, which switches the CSS color tokens.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>(this.readStored() ?? 'dark');
  readonly theme = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  toggle(): void {
    this.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.current.set(theme);
    this.apply(theme);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage unavailable: the theme still applies for this visit.
    }
  }

  private apply(theme: Theme): void {
    const html = this.document.documentElement;
    html.setAttribute('data-theme', theme);
    html.style.colorScheme = theme;
  }

  private readStored(): Theme | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }
}
