/** Injection token: provides an `LlmClient`, or `null` when there is no GEMINI_API_KEY. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmRequest {
  systemInstruction: string;
  userMessage: string;
  responseSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface LlmResult {
  text: string;
  usage: LlmUsage;
}

/** A failed call. Carries the tokens that were spent anyway (zero when unknown). */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly usage: LlmUsage = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmClient {
  generate(request: LlmRequest): Promise<LlmResult>;
}
