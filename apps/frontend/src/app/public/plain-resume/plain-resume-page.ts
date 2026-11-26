import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ContentApi } from '../../core/content/content-api.service';
import { PlainResume } from './plain-resume';

/** The classic resume: readable, printable (Save as PDF), and ATS-friendly. */
@Component({
  selector: 'app-plain-resume-page',
  imports: [PlainResume, RouterLink],
  templateUrl: './plain-resume-page.html',
  styles: `
    .loading {
      color: var(--color-text-muted);
    }
  `,
})
export class PlainResumePage {
  private readonly api = inject(ContentApi);

  protected readonly resume = rxResource({ stream: () => this.api.resume() });
  /** Only the signed-in admin gets the Edit link to the in-place editor. */
  protected readonly signedIn = inject(AuthService).isAuthenticated;

  protected print(): void {
    window.print();
  }
}
