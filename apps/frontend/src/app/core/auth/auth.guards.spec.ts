import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

@Component({ template: 'page' })
class Page {}

describe('auth guards', () => {
  const isAuthenticated = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/login', canActivate: [guestGuard], component: Page },
          { path: 'admin', canActivate: [authGuard], children: [{ path: '**', component: Page }] },
          { path: '**', component: Page },
        ]),
        { provide: AuthService, useValue: { isAuthenticated: isAuthenticated.asReadonly() } },
      ],
    });
  });

  async function go(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('sends visitors from an admin page to the login page, keeping where they wanted to go', async () => {
    isAuthenticated.set(false);
    expect(await go('/admin/profile')).toBe('/admin/login?returnUrl=%2Fadmin%2Fprofile');
  });

  it('lets the signed-in admin into admin pages', async () => {
    isAuthenticated.set(true);
    expect(await go('/admin/profile')).toBe('/admin/profile');
  });

  it('sends a signed-in admin away from the login page to the admin home', async () => {
    isAuthenticated.set(true);
    expect(await go('/admin/login')).toBe('/admin');
  });

  it('shows the login page to visitors', async () => {
    isAuthenticated.set(false);
    expect(await go('/admin/login')).toBe('/admin/login');
  });

  describe('safeReturnUrl', () => {
    it.each([
      ['/admin/profile', '/admin/profile'],
      ['/resume?x=1', '/resume?x=1'],
      [null, '/admin'],
      ['', '/admin'],
      ['https://evil.example', '/admin'],
      ['//evil.example', '/admin'],
      ['/\\evil.example', '/admin'],
      ['javascript:alert(1)', '/admin'],
    ])('%s -> %s (only same-site paths, no open redirect)', (input, expected) => {
      expect(safeReturnUrl(input)).toBe(expected);
    });
  });
});
