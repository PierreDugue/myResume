import { Component, input } from '@angular/core';
import type { LogLine } from '@my-resume/api-models';

/** The latest highlights, printed like log lines. */
@Component({
  selector: 'app-log-preview',
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
  `,
})
export class LogPreview {
  readonly lines = input.required<LogLine[]>();
}
