import { Component, computed, input } from '@angular/core';

export interface GaugeItem {
  label: string;
  value: number;
  /** Formatted value, e.g. "3.8 yrs". */
  display: string;
  note: string | null;
}

export interface GaugeGroup {
  label: string;
  items: GaugeItem[];
}

/** Horizontal bars grouped under headings; every bar also states its value in text. */
@Component({
  selector: 'app-bar-gauge',
  template: `
    @if (groups().length === 0) {
      <p class="empty">No data for this selection.</p>
    } @else {
      @for (group of groups(); track group.label) {
        <h3>{{ group.label }}</h3>
        <ul>
          @for (item of group.items; track item.label) {
            <li>
              <span class="name"
                >{{ item.label }}
                @if (item.note) {
                  <span class="note">&#32;{{ item.note }}</span>
                }
              </span>
              <span class="bar" aria-hidden="true"
                ><span class="fill" [style.width]="width(item.value)"></span
              ></span>
              <span class="amount">{{ item.display }}</span>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h3 {
      margin: var(--space-3) 0 var(--space-1);
      color: var(--color-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h3:first-child {
      margin-top: 0;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: minmax(80px, 30%) 1fr auto;
      align-items: center;
      gap: var(--space-2);
      padding: 2px 0;
      font-size: 0.8125rem;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar {
      height: 10px;
      border-radius: 2px;
      background: var(--color-surface-2);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--series-1), var(--series-3));
    }
    .amount {
      font: var(--font-mono-sm);
    }
    .note {
      color: var(--color-text-muted);
      font-size: 0.6875rem;
    }
    .empty {
      color: var(--color-text-muted);
    }
  `,
})
export class BarGauge {
  readonly groups = input.required<GaugeGroup[]>();

  private readonly max = computed(() =>
    Math.max(0, ...this.groups().flatMap((g) => g.items.map((i) => i.value))),
  );

  protected width(value: number): string {
    const max = this.max();
    return `${max > 0 ? +((value / max) * 100).toFixed(1) : 0}%`;
  }
}
