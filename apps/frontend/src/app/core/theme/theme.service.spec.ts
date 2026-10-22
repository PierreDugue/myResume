import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const html = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.restoreAllMocks());

  it('defaults to the dark theme when nothing is stored', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('dark');
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('restores the theme stored by a previous visit', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('light');
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('toggles between dark and light, applies it to <html> and remembers it', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    expect(theme.theme()).toBe('light');
    expect(html.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    theme.toggle();
    expect(theme.theme()).toBe('dark');
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps working when storage is unavailable (private mode, blocked cookies)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('dark');
    expect(() => theme.toggle()).not.toThrow();
    expect(theme.theme()).toBe('light');
  });
});
