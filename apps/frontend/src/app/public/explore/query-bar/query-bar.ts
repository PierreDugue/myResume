import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  applySuggestion,
  parseQuery,
  QueryParseError,
  suggest,
  type LabelValues,
  type Suggestion,
} from '@my-resume/query-parser';

/**
 * The Explore query input: a combobox that suggests label names and values (shared parser
 * `suggest()`), checks the query with the same parser as the server before running it, and shows
 * where a query is wrong. Emits `run` with a valid query.
 */
@Component({
  selector: 'app-query-bar',
  templateUrl: './query-bar.html',
  styleUrl: './query-bar.scss',
})
export class QueryBar {
  /** The query to show (from the URL). */
  readonly value = input('');
  readonly labels = input<LabelValues[]>([]);
  /** The server's error for `value`. */
  readonly error = input<string | null>(null);
  readonly run = output<string>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly text = signal('');
  private readonly cursor = signal(0);
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  private readonly localError = signal<string | null>(null);

  private readonly suggestions = computed(() =>
    this.open() ? suggest(this.text(), this.cursor(), this.labels()) : null,
  );
  protected readonly items = computed(() => this.suggestions()?.items ?? []);
  /** A parse error of what was typed, else the server's error while the query is unchanged. */
  protected readonly shownError = computed(
    () => this.localError() ?? (this.text() === this.value() ? this.error() : null),
  );

  constructor() {
    // Follow the query from outside (URL changes); writing the DOM keeps the caret where it is
    // while the user types, which a [value] binding would not.
    effect(() => {
      const value = this.value();
      untracked(() => {
        this.input().nativeElement.value = value;
        this.text.set(value);
        this.localError.set(null);
      });
    });
  }

  protected onInput(): void {
    this.syncFromElement();
    this.localError.set(null);
    this.open.set(true);
    this.active.set(-1);
  }

  protected syncFromElement(): void {
    const el = this.input().nativeElement;
    this.text.set(el.value);
    this.cursor.set(el.selectionStart ?? el.value.length);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const listed = items.length > 0;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!listed) {
          this.syncFromElement();
          this.open.set(true);
        } else this.active.set((this.active() + 1) % items.length);
        break;
      case 'ArrowUp':
        if (listed) {
          event.preventDefault();
          this.active.set(this.active() <= 0 ? items.length - 1 : this.active() - 1);
        }
        break;
      case 'Enter':
        event.preventDefault();
        if (listed && this.active() >= 0) this.accept(items[this.active()]);
        else this.submit();
        break;
      case 'Tab':
        if (listed) {
          event.preventDefault();
          this.accept(items[Math.max(this.active(), 0)]);
        }
        break;
      case 'Escape':
        if (listed) {
          event.preventDefault();
          this.open.set(false);
          this.active.set(-1);
        }
        break;
    }
  }

  protected accept(item: Suggestion): void {
    const suggestions = this.suggestions();
    if (!suggestions) return;
    const { text, cursor } = applySuggestion(this.text(), suggestions, item);
    const el = this.input().nativeElement;
    el.value = text;
    el.focus();
    el.setSelectionRange(cursor, cursor);
    this.text.set(text);
    this.cursor.set(cursor);
    this.localError.set(null);
    this.active.set(-1);
    this.open.set(true); // a label name leads straight to its values
  }

  protected submit(): void {
    this.open.set(false);
    const text = this.input().nativeElement.value;
    this.text.set(text);
    try {
      parseQuery(text);
    } catch (e) {
      if (e instanceof QueryParseError) {
        this.localError.set(e.message);
        return;
      }
      throw e;
    }
    this.run.emit(text);
  }
}
