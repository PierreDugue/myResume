import { Component, input } from '@angular/core';

/** A big number with its label (Grafana "stat" panel). */
@Component({
  selector: 'app-stat-panel',
  template: `
    <p class="value">{{ display() }}</p>
    <p class="label">{{ label() }}</p>
    @if (hint(); as text) {
      <p class="hint">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 96px;
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
    }
    p {
      margin: 0;
    }
    .value {
      color: var(--color-accent);
      font: 600 1.75rem/1.2 var(--font-sans);
    }
    .label {
      color: var(--color-text);
      font-weight: 500;
    }
    .hint {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
    }
  `,
})
export class StatPanel {
  readonly label = input.required<string>();
  readonly display = input.required<string>();
  readonly hint = input<string | null>(null);
}
