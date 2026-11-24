import { Logger } from '@nestjs/common';
import { LlmError, type LlmClient, type LlmRequest, type LlmResult } from './llm-client';

/** Structural subset of the SDK's generateContent parameters. */
export interface GeminiGenerateParams {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    responseMimeType: string;
    responseJsonSchema: Record<string, unknown>;
    maxOutputTokens: number;
    temperature?: number;
    abortSignal?: AbortSignal;
    /**
     * Other SDK settings (`thinkingConfig`). Kept open: the SDK types `thinkingLevel` as an enum,
     * which plain literals can't be assigned to; `GeminiThinkingConfig` checks them instead.
     */
    [key: string]: unknown;
  };
}

/** The SDK's `ThinkingConfig`: a token budget (Gemini 2.5) or a level (Gemini 3). */
export interface GeminiThinkingConfig {
  thinkingBudget?: number;
  thinkingLevel?: 'MINIMAL' | 'LOW';
}

/** Structural subset of the SDK's response. */
export interface GeminiResponse {
  text?: string;
  /** Why generation stopped (e.g. `STOP`, `MAX_TOKENS`, `SAFETY`): logged when there is no text. */
  candidates?: { finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

/** Structural subset of the SDK's `models`. */
export interface GeminiModels {
  generateContent(params: GeminiGenerateParams): Promise<GeminiResponse>;
}

/**
 * Gemini behind `LlmClient`. It tries the configured models in order and keeps the first one that
 * answers for the next questions, so a model Google retires or rate-limits doesn't take the
 * assistant down. One deadline covers all the attempts.
 */
export class GeminiLlmClient implements LlmClient {
  private readonly logger = new Logger(GeminiLlmClient.name);
  /** Index of the model to try first: the one that last answered. */
  private preferred = 0;

  constructor(
    private readonly models: GeminiModels,
    private readonly modelIds: readonly string[],
    private readonly timeoutMs = 20_000,
  ) {}

  async generate(request: LlmRequest): Promise<LlmResult> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new LlmError('The LLM did not answer in time'));
      }, this.timeoutMs);
    });

    try {
      for (const index of this.attemptOrder()) {
        const model = this.modelIds[index];
        let response: GeminiResponse;
        try {
          response = await Promise.race([
            this.models.generateContent(this.params(model, request, controller.signal)),
            timeout,
          ]);
        } catch (error) {
          if (timedOut) {
            this.logger.warn(`Gemini model ${model} did not answer within ${this.timeoutMs} ms`);
            throw error;
          }
          if (error instanceof LlmError) throw error;
          // Never log or pass on the SDK's message: it may quote the request or the key.
          this.logger.warn(`Gemini model ${model} failed (status ${statusOf(error)})`);
          continue;
        }
        this.preferred = index;
        if (!response.text) {
          const reason = response.candidates?.[0]?.finishReason ?? 'unknown';
          this.logger.warn(`Gemini model ${model} returned no text (finish reason ${reason})`);
        }
        return toResult(response);
      }
      throw new LlmError('The LLM call failed');
    } finally {
      clearTimeout(timer);
    }
  }

  /** The preferred model first, then the ones after it, wrapping around to the start. */
  private attemptOrder(): number[] {
    const count = this.modelIds.length;
    return this.modelIds.map((_id, offset) => (this.preferred + offset) % count);
  }

  private params(model: string, request: LlmRequest, signal: AbortSignal): GeminiGenerateParams {
    return {
      model,
      contents: request.userMessage,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: request.responseSchema,
        maxOutputTokens: request.maxOutputTokens,
        temperature: 0.2,
        abortSignal: signal,
        ...minimalThinking(model),
      },
    };
  }
}

function toResult(response: GeminiResponse): LlmResult {
  const meta = response.usageMetadata;
  const usage = {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
  if (!response.text) throw new LlmError('The LLM returned no text', usage);
  return { text: response.text, usage };
}

/** The HTTP status of an SDK error (its `ApiError` has one), or "unknown". */
function statusOf(error: unknown): number | 'unknown' {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 'unknown';
}

/**
 * As little "thinking" as the model allows, for latency and cost, for the families whose settings
 * are known: Gemini 2.5 takes a token budget (0 turns it off, except on Pro, whose minimum is 128),
 * Gemini 3 a level (Pro has no MINIMAL). Any other model keeps its own default.
 */
function minimalThinking(model: string): { thinkingConfig?: GeminiThinkingConfig } {
  if (model.startsWith('gemini-2.5-flash')) return { thinkingConfig: { thinkingBudget: 0 } };
  if (model.startsWith('gemini-2.5-pro')) return { thinkingConfig: { thinkingBudget: 128 } };
  if (/^gemini-3(\.\d+)?-flash/.test(model))
    return { thinkingConfig: { thinkingLevel: 'MINIMAL' } };
  if (/^gemini-3(\.\d+)?-pro/.test(model)) return { thinkingConfig: { thinkingLevel: 'LOW' } };
  return {};
}
