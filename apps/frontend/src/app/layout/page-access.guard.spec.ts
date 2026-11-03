import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { PagePreferences, PublicPageId, SitePreferences } from '@my-resume/api-models';
import { NEVER, Observable, Subject, firstValueFrom, of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { SitePreferencesStore } from '../core/preferences/site-preferences.store';
import { PAGE_PREFERENCES_WAIT_MS, pageAccessGuard } from './page-access.guard';

const prefs = (off: PublicPageId[] = []): SitePreferences => {
  const pages = {} as PagePreferences;
  for (const id of ['overview', 'explore', 'traces', 'serviceMap', 'quality', 'about'] as const) {
    pages[id] = !off.includes(id);
  }
  return { pages, overview: { skillsOverTime: [] } };
};

describe('pageAccessGuard', () => {
  const preferences = signal<SitePreferences | null>(null);
  const isAuthenticated = signal(false);
  let load: () => Observable<void>;

  beforeEach(() => {
    preferences.set(null);
    isAuthenticated.set(false);
    load = () => {
      preferences.set(prefs());
      return of(undefined);
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SitePreferencesStore,
          useValue: { preferences: preferences.asReadonly(), load: () => load() },
        },
        { provide: AuthService, useValue: { isAuthenticated: isAuthenticated.asReadonly() } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  const run = (data: Record<string, unknown>) =>
    TestBed.runInInjectionContext(() =>
      pageAccessGuard({ data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
  const path = (result: boolean | UrlTree) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  it('allows routes that are not public pages', async () => {
    load = () => {
      preferences.set(prefs(['overview', 'explore', 'traces', 'serviceMap', 'quality', 'about']));
      return of(undefined);
    };
    expect(path(await firstValueFrom(run({})))).toBe(true);
  });

  it('allows an enabled page', async () => {
    expect(path(await firstValueFrom(run({ page: 'explore' })))).toBe(true);
  });

  it('redirects a visitor from a disabled page to the home page', async () => {
    load = () => {
      preferences.set(prefs(['explore']));
      return of(undefined);
    };
    expect(path(await firstValueFrom(run({ page: 'explore' })))).toBe('/');
  });

  it('redirects from a disabled home page to the first enabled page', async () => {
    load = () => {
      preferences.set(prefs(['overview', 'explore']));
      return of(undefined);
    };
    expect(path(await firstValueFrom(run({ page: 'overview' })))).toBe('/traces');
  });

  it('redirects to the plain view when every page is disabled', async () => {
    load = () => {
      preferences.set(prefs(['overview', 'explore', 'traces', 'serviceMap', 'quality', 'about']));
      return of(undefined);
    };
    expect(path(await firstValueFrom(run({ page: 'about' })))).toBe('/resume');
  });

  it('lets the admin open a disabled page', async () => {
    isAuthenticated.set(true);
    load = () => {
      preferences.set(prefs(['explore']));
      return of(undefined);
    };
    expect(path(await firstValueFrom(run({ page: 'explore' })))).toBe(true);
  });

  it('allows (fails open) when the preferences cannot be loaded', async () => {
    load = () => of(undefined); // the store completes even when the request fails
    expect(path(await firstValueFrom(run({ page: 'explore' })))).toBe(true);
  });

  it('allows after waiting 3 seconds when the request is slow', async () => {
    vi.useFakeTimers();
    load = () => NEVER; // never answers
    let result: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (result = r));

    await vi.advanceTimersByTimeAsync(PAGE_PREFERENCES_WAIT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(path(result as boolean | UrlTree)).toBe(true);
    expect(PAGE_PREFERENCES_WAIT_MS).toBe(3000);
  });

  it('does not wait for the timeout when the preferences arrive in time', async () => {
    vi.useFakeTimers();

    const answer = new Subject<void>();
    const arrive = () => {
      preferences.set(prefs(['explore']));
      answer.next();
      answer.complete();
    };
    load = () => answer;
    let result: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (result = r));
    await vi.advanceTimersByTimeAsync(1000);
    arrive();
    await vi.advanceTimersByTimeAsync(0);
    expect(path(result as boolean | UrlTree)).toBe('/');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits only once while the same request is still pending, and resumes when it ends', async () => {
    vi.useFakeTimers();

    const pending = new Subject<void>();
    const arrive = () => {
      preferences.set(prefs(['explore']));
      pending.next();
      pending.complete();
    };
    load = () => pending;

    let first: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (first = r));
    await vi.advanceTimersByTimeAsync(PAGE_PREFERENCES_WAIT_MS);
    expect(path(first as boolean | UrlTree)).toBe(true);

    // A second navigation while the request is still in flight does not wait again.
    let second: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (second = r));
    await vi.advanceTimersByTimeAsync(0);
    expect(path(second as boolean | UrlTree)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    // Once the request has finished, the loaded preferences decide.
    arrive();
    load = () => of(undefined);
    expect(path(await firstValueFrom(run({ page: 'explore' })))).toBe('/');
  });

  it('waits again for a new request after the previous one ended', async () => {
    vi.useFakeTimers();
    load = () => new Observable<void>(); // never answers
    let first: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (first = r));
    await vi.advanceTimersByTimeAsync(PAGE_PREFERENCES_WAIT_MS);
    expect(first).toBe(true);

    // A different pending request (the earlier one failed, a later load() retried).
    load = () => new Observable<void>(); // never answers
    let second: boolean | UrlTree | undefined;
    run({ page: 'explore' }).subscribe((r) => (second = r));
    await vi.advanceTimersByTimeAsync(PAGE_PREFERENCES_WAIT_MS - 1);
    expect(second).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(second).toBe(true);
  });
});
