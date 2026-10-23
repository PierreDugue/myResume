import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { AuthUser, LoginResponse } from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { fakeJwt, inSeconds } from './test-tokens';

describe('AuthService', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http?.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts signed out when nothing is stored', () => {
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(auth.email()).toBeNull();
  });

  it('logs in with POST /api/auth/login, keeps the token in memory and in localStorage', async () => {
    const auth = setup();
    const token = fakeJwt({ exp: inSeconds(3600) });

    const done = firstValueFrom(
      auth.login({ email: 'pierre@example.com', password: 'secret-123' }),
    );
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'pierre@example.com', password: 'secret-123' });
    req.flush({ accessToken: token, expiresIn: 3600 } satisfies LoginResponse);
    await done;

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe(token);
    expect(auth.email()).toBe('pierre@example.com');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(token);
  });

  it('fails the login observable and stays signed out on 401', async () => {
    const auth = setup();
    const done = firstValueFrom(auth.login({ email: 'pierre@example.com', password: 'wrong' }));
    http
      .expectOne('/api/auth/login')
      .flush(
        { statusCode: 401, message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await expect(done).rejects.toMatchObject({ status: 401 });
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('restores a valid stored session on startup', () => {
    const token = fakeJwt({ exp: inSeconds(3600) });
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe(token);
  });

  it.each([
    ['an expired token', () => fakeJwt({ exp: inSeconds(-10) })],
    ['a malformed token', () => 'not-a-jwt'],
  ])('ignores and removes %s found in storage', (_case, makeToken) => {
    localStorage.setItem(AUTH_STORAGE_KEY, makeToken());
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('logs out: forgets the token in memory and in storage', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(3600) }));
    const auth = setup();
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('signs out automatically when the token expires', () => {
    vi.useFakeTimers();
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(60) }));
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it.each([
    ['/admin/projects/1', true],
    ['/admin/login', false],
    ['/traces', false],
  ])('when the token expires on %s, goes to the login page: %s', (url, redirects) => {
    vi.useFakeTimers();
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { url, navigate } }],
    });
    localStorage.setItem(AUTH_STORAGE_KEY, fakeJwt({ exp: inSeconds(60) }));
    setup();

    vi.advanceTimersByTime(61_000);
    if (redirects) {
      expect(navigate).toHaveBeenCalledWith(['/admin/login'], { queryParams: { returnUrl: url } });
    } else {
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it('keeps working when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const auth = setup();
    const done = firstValueFrom(
      auth.login({ email: 'pierre@example.com', password: 'secret-123' }),
    );
    http
      .expectOne('/api/auth/login')
      .flush({ accessToken: fakeJwt({ exp: inSeconds(3600) }), expiresIn: 3600 });
    await done;
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('loads the signed-in admin from GET /api/auth/me', async () => {
    const auth = setup();
    const me = firstValueFrom(auth.me());
    http
      .expectOne('/api/auth/me')
      .flush({ id: 'admin-id', email: 'pierre@example.com' } satisfies AuthUser);
    expect(await me).toEqual({ id: 'admin-id', email: 'pierre@example.com' });
  });
});
