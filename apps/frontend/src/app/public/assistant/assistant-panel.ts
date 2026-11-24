import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { AssistantApi } from '../../core/assistant/assistant-api.service';
import { assistantErrorMessage } from './assistant-errors';
import { AssistantExchange, AssistantExchangeView } from './assistant-exchange';

const MAX_QUESTION_LENGTH = 500;
const MAX_EXCHANGES = 20;
const EXAMPLES = [
  'What is the current role?',
  'Which achievements had a measurable impact?',
  'Which projects used Angular?',
];

/** The "Ask my resume" chat: holds the conversation (at most 20 exchanges), one question at a time. */
@Component({
  selector: 'app-assistant-panel',
  imports: [FormField, AssistantExchangeView],
  templateUrl: './assistant-panel.html',
  styleUrl: './assistant-panel.scss',
})
export class AssistantPanel {
  private readonly api = inject(AssistantApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private nextId = 1;

  readonly closed = output<void>();

  protected readonly examples = EXAMPLES;
  protected readonly maxLength = MAX_QUESTION_LENGTH;
  protected readonly exchanges = signal<AssistantExchange[]>([]);
  protected readonly pending = computed(() => this.exchanges().some((e) => e.state === 'pending'));
  private readonly model = signal({ question: '' });
  protected readonly form = form(this.model);
  protected readonly remaining = computed(
    () => MAX_QUESTION_LENGTH - this.model().question.trim().length,
  );

  constructor() {
    afterNextRender(() => this.host.nativeElement.querySelector('textarea')?.focus());
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.ask(this.model().question);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.ask(this.model().question);
  }

  protected ask(text: string): void {
    const question = text.trim();
    if (this.pending() || !question || question.length > MAX_QUESTION_LENGTH) return;
    const id = this.nextId++;
    this.exchanges.update((list) =>
      [...list, { id, question, state: 'pending' as const }].slice(-MAX_EXCHANGES),
    );
    this.model.set({ question: '' });
    const settle = (exchange: AssistantExchange) =>
      this.exchanges.update((list) => list.map((e) => (e.id === id ? exchange : e)));
    this.api
      .ask(question)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => settle({ id, question, state: 'answered', answer }),
        error: (error: unknown) =>
          settle({ id, question, state: 'failed', error: assistantErrorMessage(error) }),
      });
  }
}
