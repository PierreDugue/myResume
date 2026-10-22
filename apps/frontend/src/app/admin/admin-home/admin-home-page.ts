import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Admin home. The content editors arrive with build step 3 (see docs/spec.md). */
@Component({
  selector: 'app-admin-home-page',
  templateUrl: './admin-home-page.html',
  styleUrl: './admin-home-page.scss',
})
export class AdminHomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = rxResource({ stream: () => this.auth.me() });
  protected readonly sections = [
    'Profile',
    'Experience',
    'Achievements',
    'Skills',
    'Projects',
    'Education',
    'Alerts',
    'Resume PDF',
  ];

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
