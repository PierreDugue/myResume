import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Admin home. The content editors arrive with build step 3 (see docs/spec.md). */
@Component({
  selector: 'app-admin-home-page',
  imports: [RouterLink],
  templateUrl: './admin-home-page.html',
  styleUrl: './admin-home-page.scss',
})
export class AdminHomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = rxResource({ stream: () => this.auth.me() });
  protected readonly sections = [
    { label: 'Profile', path: 'profile', hint: 'Name, headline, summary, contact, links' },
    { label: 'Skills', path: 'skills', hint: 'Skills by category, with levels' },
    { label: 'Experience', path: 'experiences', hint: 'Jobs, tech stacks and achievements' },
    { label: 'Education', path: 'education', hint: 'Degrees and schools' },
    { label: 'Projects', path: 'projects', hint: 'Side projects, this site' },
  ];
  protected readonly comingSoon = ['Status alerts', 'Resume PDF'];

  protected signOut(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
