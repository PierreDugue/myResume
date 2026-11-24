import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { AskAssistantRequest, AssistantAnswer } from '@my-resume/api-models';
import { Observable } from 'rxjs';

/** `POST /api/assistant/ask`: one question, one answer (single turn, no history). */
@Service()
export class AssistantApi {
  private readonly http = inject(HttpClient);

  ask(question: string): Observable<AssistantAnswer> {
    const body: AskAssistantRequest = { question };
    return this.http.post<AssistantAnswer>('/api/assistant/ask', body);
  }
}
