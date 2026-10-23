import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const token = signal<string | null>('the-token');
  const logout = vi.fn();
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    token.set('the-token');
    logout.mockReset();
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token: token.asReadonly(), logout } },
        { provide: Router, useValue: { navigate, url: '/admin/profile' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adds the Bearer token to API calls', () => {
    http.get('/api/auth/me').subscribe();
    expect(backend.expectOne('/api/auth/me').request.headers.get('Authorization')).toBe(
      'Bearer the-token',
    );
  });

  it('never sends the token to other hosts', () => {
    http.get('https://example.com/api/data').subscribe();
    expect(
      backend.expectOne('https://example.com/api/data').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('does not send a token with the login request itself', () => {
    http.post('/api/auth/login', {}).subscribe();
    expect(backend.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
  });

  it('sends no header when signed out', () => {
    token.set(null);
    http.get('/api/health').subscribe();
    expect(backend.expectOne('/api/health').request.headers.has('Authorization')).toBe(false);
  });

  it('on 401 with a token: signs out and goes to the login page, coming back here afterwards', async () => {
    const call = firstValueFrom(http.get('/api/auth/me'));
    backend.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/admin/login'], {
      queryParams: { returnUrl: '/admin/profile' },
    });
  });

  it('on 401 after the session already ended (no token sent): goes to the login page', async () => {
    token.set(null);
    const call = firstValueFrom(http.put('/api/profile', {}));
    backend.expectOne('/api/profile').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(navigate).toHaveBeenCalledWith(['/admin/login'], {
      queryParams: { returnUrl: '/admin/profile' },
    });
  });

  it('does not redirect on a 401 from another host', async () => {
    const call = firstValueFrom(http.get('https://example.com/api/data'));
    backend
      .expectOne('https://example.com/api/data')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 from the login request (wrong password)', async () => {
    const call = firstValueFrom(http.post('/api/auth/login', {}));
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('lets other errors through untouched', async () => {
    const call = firstValueFrom(http.get('/api/health'));
    backend.expectOne('/api/health').flush(null, { status: 503, statusText: 'Unavailable' });
    await expect(call).rejects.toMatchObject({ status: 503 });
    expect(logout).not.toHaveBeenCalled();
  });
});
