import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardRange, LogLine } from '@my-resume/api-models';

/** The latest highlights, printed like log lines, with a link to Explore for the same years. */
@Component({
  selector: 'app-log-preview',
  imports: [RouterLink],
  template: `
    @if (lines().length === 0) {
      <p class="empty">No highlights in this range.</p>
    } @else {
      <ol>
        @for (line of lines(); track line.id) {
          <li>
            <!-- Spaces inside the spans: Angular drops whitespace between elements. -->
            <time [attr.datetime]="line.date">{{ line.date }}</time>
            <span class="level" [class]="line.level">&#32;{{ line.level.toUpperCase() }}</span>
            <span class="source">&#32;[{{ line.company }}]</span>
            <span class="message">&#32;{{ line.message }}</span>
          </li>
        }
      </ol>
    }
    <a class="explore" routerLink="/explore" [queryParams]="range()">Open in Explore →</a>
  `,
  styles: `
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--font-mono-sm);
    }
    li {
      padding: var(--space-1) 0;
      border-bottom: 1px solid var(--color-border);
    }
    li:last-child {
      border-bottom: 0;
    }
    time,
    .source {
      color: var(--color-text-muted);
    }
    .level {
      font-weight: 600;
      color: var(--color-link);
    }
    .level.achievement {
      color: var(--color-ok);
    }
    .level.milestone {
      color: var(--color-accent);
    }
    .level.learning {
      color: var(--series-4);
    }
    .empty {
      color: var(--color-text-muted);
    }
    .explore {
      display: inline-block;
      margin-top: var(--space-2);
      font-size: 0.8125rem;
    }
  `,
})
export class LogPreview {
  readonly lines = input.required<LogLine[]>();
  /** The dashboard's years, carried over to Explore. */
  readonly range = input<DashboardRange | null>(null);
}
