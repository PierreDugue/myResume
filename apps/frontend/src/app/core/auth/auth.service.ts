import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';
import type { AuthUser, LoginRequest, LoginResponse } from '@my-resume/api-models';
import { Observable, map } from 'rxjs';

export const AUTH_STORAGE_KEY = 'auth.token';

interface Session {
  token: string;
  email: string | null;
  /** Expiry, in seconds since epoch (JWT `exp`). */
  exp: number;
}

/**
 * The admin session: a JWT kept in memory and in localStorage (see docs/spec.md, Auth).
 * The token is only read to know who is signed in and when it expires; the API verifies it.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly session = signal<Session | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly token = computed(() => this.session()?.token ?? null);
  readonly email = computed(() => this.session()?.email ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    const stored = this.read();
    if (stored === null) return;
    const session = parseToken(stored);
    if (session && !isExpired(session)) this.start(session);
    else this.remove();
  }

  /** `POST /api/auth/login`. Errors (401, 429, ...) are passed on to the caller. */
  login(credentials: LoginRequest): Observable<void> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
      map(({ accessToken }) => {
        const session = parseToken(accessToken);
        if (!session) throw new Error('The API returned an unreadable token');
        this.start(session);
        this.write(accessToken);
      }),
    );
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    this.session.set(null);
    this.remove();
  }

  /** `GET /api/auth/me`: the signed-in admin, as seen by the API. */
  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/auth/me');
  }

  private start(session: Session): void {
    this.session.set(session);
    clearTimeout(this.expiryTimer);
    const msLeft = Math.min(session.exp * 1000 - Date.now(), 2 ** 31 - 1);
    this.expiryTimer = setTimeout(() => this.logout(), msLeft);
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(AUTH_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private write(token: string): void {
    try {
      this.storage?.setItem(AUTH_STORAGE_KEY, token);
    } catch {
      // Storage unavailable: the session lasts until the tab is closed.
    }
  }

  private remove(): void {
    try {
      this.storage?.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // nothing to clean up
    }
  }
}

function parseToken(token: string): Session | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      email?: unknown;
      exp?: unknown;
    };
    if (typeof claims.exp !== 'number') return null;
    return {
      token,
      exp: claims.exp,
      email: typeof claims.email === 'string' ? claims.email : null,
    };
  } catch {
    return null;
  }
}

function isExpired(session: Session): boolean {
  return session.exp * 1000 <= Date.now();
}
