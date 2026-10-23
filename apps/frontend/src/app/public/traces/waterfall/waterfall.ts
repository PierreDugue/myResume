import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { TraceSpan } from '@my-resume/api-models';
import { formatDate, formatDuration, timeTicks } from '../trace-format';

/**
 * A trace waterfall: one row per span (the root first), its bar placed on the root's time axis.
 * Rows open to show the dates, the note and the technologies (links to the filtered dashboard).
 * Plain HTML/CSS, so it stays light and readable by screen readers.
 */
@Component({
  selector: 'app-waterfall',
  imports: [RouterLink],
  templateUrl: './waterfall.html',
  styleUrl: './waterfall.scss',
})
export class Waterfall {
  readonly spans = input.required<TraceSpan[]>();

  private readonly open = signal<ReadonlySet<string>>(new Set());
  protected readonly ticks = computed(() => {
    const root = this.spans()[0];
    return root ? timeTicks(root.startDate, root.durationDays) : [];
  });
  protected readonly formatDate = formatDate;
  protected readonly formatDuration = formatDuration;

  protected isOpen(id: string): boolean {
    return this.open().has(id);
  }

  protected toggle(id: string): void {
    this.open.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Bar color per depth (5 levels at most), so a level keeps its color in every trace. */
  protected barClass(span: TraceSpan): string {
    return `bar depth-${Math.min(span.depth, 4)}`;
  }
}
