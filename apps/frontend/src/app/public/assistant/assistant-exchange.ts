import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AssistantAnswer } from '@my-resume/api-models';

export type AssistantExchange =
  | { id: number; question: string; state: 'pending' }
  | { id: number; question: string; state: 'answered'; answer: AssistantAnswer }
  | { id: number; question: string; state: 'failed'; error: string };

/** One question and its answer (or "Thinking…", or an error). Everything is rendered as text. */
@Component({
  selector: 'app-assistant-exchange',
  imports: [RouterLink],
  templateUrl: './assistant-exchange.html',
  styleUrl: './assistant-exchange.scss',
})
export class AssistantExchangeView {
  readonly exchange = input.required<AssistantExchange>();

  protected readonly answered = computed(() => {
    const e = this.exchange();
    return e.state === 'answered' ? e.answer : null;
  });
  protected readonly failedMessage = computed(() => {
    const e = this.exchange();
    return e.state === 'failed' ? e.error : '';
  });
}
