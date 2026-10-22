import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { showError } from '../shared/form-utils';

@Component({
  selector: 'app-login-page',
  imports: [FormField, FormRoot],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  private readonly credentials = signal({ email: '', password: '' });

  protected readonly error = signal<string | null>(null);
  protected readonly form = form(
    this.credentials,
    (c) => {
      required(c.email, { message: 'Enter your email address' });
      email(c.email, { message: 'Enter a valid email address' });
      required(c.password, { message: 'Enter your password' });
    },
    { submission: { action: () => this.signIn() } },
  );
  protected readonly showError = showError;

  private async signIn(): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.auth.login(this.credentials()));
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl));
    } catch (e) {
      this.error.set(messageFor(e));
    }
  }
}

function messageFor(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 401) return 'Invalid email or password.';
  if (status === 429) return 'Too many attempts. Try again in a minute.';
  return 'Sign-in failed. Please try again.';
}
