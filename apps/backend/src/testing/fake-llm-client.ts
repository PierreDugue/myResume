import type { LlmClient, LlmRequest, LlmResult } from '../app/assistant/llm/llm-client';

/** An `LlmClient` for tests: records every request and answers (or fails) as told. */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];
  private outcome: { result: LlmResult } | { error: unknown } = {
    result: { text: '{"answer":"ok"}', usage: { inputTokens: 0, outputTokens: 0 } },
  };

  answerWith(result: LlmResult): this {
    this.outcome = { result };
    return this;
  }

  failWith(error: unknown): this {
    this.outcome = { error };
    return this;
  }

  generate(request: LlmRequest): Promise<LlmResult> {
    this.requests.push(request);
    return 'error' in this.outcome
      ? Promise.reject(this.outcome.error)
      : Promise.resolve(this.outcome.result);
  }
}
