import { Component, input, output, signal } from '@angular/core';
import type { LogEntry } from '@my-resume/api-models';

/** A request to narrow the query from a line: `label op "value"`. */
export interface LabelFilter {
  label: string;
  value: string;
  op: '=' | '!=';
}

/** Explore results: one log line per entry, each expandable to show its labels. */
@Component({
  selector: 'app-log-list',
  templateUrl: './log-list.html',
  styleUrl: './log-list.scss',
})
export class LogList {
  readonly entries = input.required<LogEntry[]>();
  readonly filter = output<LabelFilter>();

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggle(id: string): void {
    this.expanded.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected labelsOf(entry: LogEntry): [string, string][] {
    return Object.entries(entry.labels);
  }
}
