import { Component, computed, input } from '@angular/core';
import type { CareerStatus, PublicProfile } from '@my-resume/api-models';

/** Who this is: photo, headline, status and links (Grafana "text" panel). */
@Component({
  selector: 'app-profile-panel',
  template: `
    @if (profile(); as p) {
      <div class="who">
        @if (p.avatarUrl) {
          <img [src]="p.avatarUrl" [alt]="p.fullName" width="64" height="64" />
        }
        <div>
          <h3>{{ p.fullName }}</h3>
          <p class="headline">{{ p.headline }}</p>
          <p class="status" [class.employed]="status().state === 'employed'">
            <span class="dot" aria-hidden="true"></span>{{ statusText() }}
          </p>
          @if (p.location) {
            <p class="location">
              {{ p.location }}
              @if (status().openToRelocation) {
                <span> · open to relocation</span>
              }
            </p>
          }
        </div>
      </div>
      <p class="summary">{{ p.summary }}</p>
      @if (p.links.length) {
        <ul class="links">
          @for (link of p.links; track link.url) {
            <li>
              <a [href]="link.url" target="_blank" rel="noopener">{{ link.label }}</a>
            </li>
          }
        </ul>
      }
    } @else {
      <p class="muted">No profile yet.</p>
    }
  `,
  styles: `
    .who {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
    }
    img {
      border-radius: 50%;
      object-fit: cover;
    }
    h3 {
      margin: 0;
      font-size: 1.25rem;
    }
    p {
      margin: 0;
    }
    .headline {
      color: var(--color-accent);
    }
    .status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
      font: var(--font-mono-sm);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-warn);
    }
    .employed .dot {
      background: var(--color-ok);
    }
    .location,
    .muted {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
    .summary {
      margin-top: var(--space-3);
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: var(--space-3) 0 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class ProfilePanel {
  readonly profile = input.required<PublicProfile | null>();
  readonly status = input.required<CareerStatus>();

  protected readonly statusText = computed(() => {
    const s = this.status();
    return s.state === 'employed' ? `Employed at ${s.company}` : 'Open to work';
  });
}
