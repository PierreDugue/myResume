import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';
import { $ } from '../../testing';

describe('LoginPage', () => {
  let login$: Subject<void>;
  const login = vi.fn();
  let returnUrl: string | null;

  async function render() {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { fixture, el, navigate };
  }

  function fill(el: HTMLElement, email: string, password: string) {
    const emailInput = $<HTMLInputElement>(el, 'input[type="email"]');
    const passwordInput = $<HTMLInputElement>(el, 'input[type="password"]');
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
  }

  const submit = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();

  beforeEach(() => {
    login$ = new Subject<void>();
    login.mockReset().mockReturnValue(login$);
    returnUrl = null;
  });

  it('has labelled email and password fields with autocomplete hints', async () => {
    const { el } = await render();
    const email = $(el, 'input[type="email"]');
    const password = $(el, 'input[type="password"]');
    expect(el.querySelector(`label[for="${email.id}"]`)?.textContent).toMatch(/email/i);
    expect(el.querySelector(`label[for="${password.id}"]`)?.textContent).toMatch(/password/i);
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
  });

  it('shows field errors and does not call the API when the form is invalid', async () => {
    const { el, fixture } = await render();
    fill(el, 'not-an-email', '');
    submit(el);
    await fixture.whenStable();

    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a valid email address');
    expect(el.textContent).toContain('Enter your password');
    expect(el.querySelector('input[type="email"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('signs in and goes to the admin home', async () => {
    const { el, fixture, navigate } = await render();
    fill(el, 'pierre@example.com', 'secret-123');
    submit(el);

    expect(login).toHaveBeenCalledWith({ email: 'pierre@example.com', password: 'secret-123' });
    login$.next();
    login$.complete();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('goes back to the page that required signing in', async () => {
    returnUrl = '/admin/profile';
    const { el, fixture, navigate } = await render();
    fill(el, 'pierre@example.com', 'secret-123');
    submit(el);
    login$.next();
    login$.complete();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/admin/profile');
  });

  it('never redirects to another site after signing in', async () => {
    returnUrl = 'https://evil.example';
    const { el, fixture, navigate } = await render();
    fill(el, 'pierre@example.com', 'secret-123');
    submit(el);
    login$.next();
    login$.complete();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('disables the button while signing in', async () => {
    const { el, fixture } = await render();
    fill(el, 'pierre@example.com', 'secret-123');
    submit(el);
    await fixture.whenStable();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(true);
  });

  it.each([
    [401, 'Invalid email or password.'],
    [429, 'Too many attempts. Try again in a minute.'],
    [0, 'Sign-in failed. Please try again.'],
  ])('shows an alert for a %s response and allows another try', async (status, message) => {
    const { el, fixture } = await render();
    fill(el, 'pierre@example.com', 'secret-123');
    submit(el);
    login$.error(new HttpErrorResponse({ status }));
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(false);
  });
});
