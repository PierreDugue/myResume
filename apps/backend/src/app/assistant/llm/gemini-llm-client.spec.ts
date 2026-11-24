import {
  GeminiGenerateParams,
  GeminiLlmClient,
  GeminiModels,
  GeminiResponse,
} from './gemini-llm-client';
import { Logger } from '@nestjs/common';
import { LlmError, LlmRequest } from './llm-client';

const REQUEST: LlmRequest = {
  systemInstruction: 'SYSTEM RULES with the resume',
  userMessage: 'Where did Ada work?',
  responseSchema: { type: 'object', properties: { answer: { type: 'string' } } },
  maxOutputTokens: 800,
};

describe('GeminiLlmClient', () => {
  const generateContent = vi.fn<(params: GeminiGenerateParams) => Promise<GeminiResponse>>();
  const models: GeminiModels = { generateContent };
  const client = (timeoutMs?: number) => new GeminiLlmClient(models, ['gemini-test'], timeoutMs);

  beforeEach(() => {
    generateContent.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends the model, the user message and the generation settings', async () => {
    generateContent.mockResolvedValue({ text: '{"answer":"x"}' });
    await client().generate(REQUEST);

    expect(generateContent).toHaveBeenCalledTimes(1);
    const params = generateContent.mock.calls[0][0];
    expect(params.model).toBe('gemini-test');
    expect(params.contents).toBe('Where did Ada work?');
    expect(params.config.systemInstruction).toBe('SYSTEM RULES with the resume');
    expect(params.config.responseMimeType).toBe('application/json');
    expect(params.config.responseJsonSchema).toEqual(REQUEST.responseSchema);
    expect(params.config.maxOutputTokens).toBe(800);
    expect(params.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it.each<[string, Record<string, unknown> | undefined]>([
    ['gemini-2.5-flash', { thinkingBudget: 0 }],
    ['gemini-2.5-flash-lite', { thinkingBudget: 0 }],
    ['gemini-2.5-pro', { thinkingBudget: 128 }],
    ['gemini-3-flash-preview', { thinkingLevel: 'MINIMAL' }],
    ['gemini-3.1-flash', { thinkingLevel: 'MINIMAL' }],
    ['gemini-3.8-flash', { thinkingLevel: 'MINIMAL' }],
    ['gemini-3-pro-preview', { thinkingLevel: 'LOW' }],
    ['gemini-flash-latest', undefined],
    ['gemini-1.5-flash', undefined],
    ['gemini-test', undefined],
  ])('keeps thinking minimal for %s', async (model, thinking) => {
    generateContent.mockResolvedValue({ text: 'x' });
    await new GeminiLlmClient(models, [model]).generate(REQUEST);

    const { config } = generateContent.mock.calls[0][0];
    if (thinking) expect(config.thinkingConfig).toEqual(thinking);
    else expect(config).not.toHaveProperty('thinkingConfig');
  });

  it('returns the text and the token usage (thinking tokens count as output)', async () => {
    generateContent.mockResolvedValue({
      text: '{"answer":"Acme"}',
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 30, thoughtsTokenCount: 12 },
    });
    expect(await client().generate(REQUEST)).toEqual({
      text: '{"answer":"Acme"}',
      usage: { inputTokens: 1200, outputTokens: 42 },
    });
  });

  it('counts missing token counts as 0', async () => {
    generateContent.mockResolvedValue({ text: 'x', usageMetadata: { promptTokenCount: 10 } });
    expect((await client().generate(REQUEST)).usage).toEqual({ inputTokens: 10, outputTokens: 0 });

    generateContent.mockResolvedValue({ text: 'x' });
    expect((await client().generate(REQUEST)).usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('throws an LlmError when the text is %s, keeping the tokens spent', async (_name, text) => {
    generateContent.mockResolvedValue({
      text,
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 3 },
    });
    const error = await client()
      .generate(REQUEST)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).usage).toEqual({ inputTokens: 500, outputTokens: 3 });
  });

  it('throws an LlmError when the SDK rejects, without the prompt or the key in the message', async () => {
    generateContent.mockRejectedValue(
      new Error(
        '403 key AIzaSECRET rejected for: SYSTEM RULES with the resume / Where did Ada work?',
      ),
    );
    const error = await client()
      .generate(REQUEST)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    const message = (error as LlmError).message;
    expect(message).not.toContain('SYSTEM RULES');
    expect(message).not.toContain('Where did Ada work?');
    expect(message).not.toContain('AIzaSECRET');
    expect((error as LlmError).usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it('throws an LlmError, and aborts the call, when there is no answer within the timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    generateContent.mockImplementation((params) => {
      signal = params.config.abortSignal;
      return new Promise<GeminiResponse>(() => undefined); // never answers
    });

    const outcome = client(50)
      .generate(REQUEST)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(49);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);

    expect(await outcome).toBeInstanceOf(LlmError);
    expect(signal?.aborted).toBe(true);
  });

  describe('fallback models', () => {
    const MODELS = ['gemini-a', 'gemini-b', 'gemini-c'];
    const sdkError = (status: number) =>
      Object.assign(new Error(`${status} key AIzaSECRET: SYSTEM RULES with the resume`), {
        status,
      });
    const modelsCalled = () => generateContent.mock.calls.map(([params]) => params.model);

    it('tries the next model when the SDK rejects one, and returns the first answer', async () => {
      generateContent
        .mockRejectedValueOnce(sdkError(404))
        .mockResolvedValueOnce({ text: '{"answer":"from b"}' });
      const result = await new GeminiLlmClient(models, MODELS).generate(REQUEST);

      expect(result.text).toBe('{"answer":"from b"}');
      expect(modelsCalled()).toEqual(['gemini-a', 'gemini-b']);
    });

    it('throws an LlmError when every model is rejected, after trying each once', async () => {
      generateContent.mockRejectedValue(sdkError(429));
      const error = await new GeminiLlmClient(models, MODELS)
        .generate(REQUEST)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LlmError);
      expect((error as LlmError).message).not.toContain('AIzaSECRET');
      expect(modelsCalled()).toEqual(MODELS);
    });

    it('starts the next question with the model that last answered', async () => {
      const client = new GeminiLlmClient(models, MODELS);
      generateContent
        .mockRejectedValueOnce(sdkError(404))
        .mockRejectedValueOnce(sdkError(404))
        .mockResolvedValue({ text: 'x' });
      await client.generate(REQUEST);
      generateContent.mockClear();

      await client.generate(REQUEST);
      expect(modelsCalled()).toEqual(['gemini-c']);
    });

    it('continues down the list, then wraps around, when the remembered model is rejected', async () => {
      const client = new GeminiLlmClient(models, MODELS);
      generateContent.mockRejectedValueOnce(sdkError(404)).mockResolvedValueOnce({ text: 'x' });
      await client.generate(REQUEST); // b answered
      generateContent.mockClear();

      generateContent.mockRejectedValueOnce(sdkError(503)).mockResolvedValueOnce({ text: 'y' });
      expect((await client.generate(REQUEST)).text).toBe('y');
      expect(modelsCalled()).toEqual(['gemini-b', 'gemini-c']);
      generateContent.mockClear();

      generateContent.mockRejectedValueOnce(sdkError(503)).mockResolvedValueOnce({ text: 'z' });
      await client.generate(REQUEST); // c is remembered now: c, then a
      expect(modelsCalled()).toEqual(['gemini-c', 'gemini-a']);
    });

    it('uses each model with its own thinking settings', async () => {
      generateContent.mockRejectedValueOnce(sdkError(404)).mockResolvedValueOnce({ text: 'x' });
      await new GeminiLlmClient(models, ['gemini-2.5-flash', 'gemini-3.6-flash']).generate(REQUEST);

      expect(generateContent.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(generateContent.mock.calls[1][0].config.thinkingConfig).toEqual({
        thinkingLevel: 'MINIMAL',
      });
    });

    it('does not try another model when the answer is empty', async () => {
      generateContent.mockResolvedValue({ text: '' });
      const error = await new GeminiLlmClient(models, MODELS)
        .generate(REQUEST)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LlmError);
      expect(modelsCalled()).toEqual(['gemini-a']);
    });

    it('does not try another model after the timeout, which covers all the attempts', async () => {
      vi.useFakeTimers();
      generateContent
        .mockImplementationOnce(
          () =>
            new Promise<GeminiResponse>((_resolve, reject) =>
              setTimeout(() => reject(sdkError(503)), 30),
            ),
        )
        .mockImplementation(() => new Promise<GeminiResponse>(() => undefined)); // never answers

      const outcome = new GeminiLlmClient(models, MODELS, 50)
        .generate(REQUEST)
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(51);

      expect(await outcome).toBeInstanceOf(LlmError);
      expect(modelsCalled()).toEqual(['gemini-a', 'gemini-b']);
    });

    it('logs each rejected model with its HTTP status only', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      generateContent
        .mockRejectedValueOnce(sdkError(404))
        .mockRejectedValueOnce(new Error('network down AIzaSECRET'))
        .mockResolvedValueOnce({ text: 'x' });
      await new GeminiLlmClient(models, MODELS).generate(REQUEST);

      const lines = warn.mock.calls.map(([line]) => String(line));
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('gemini-a');
      expect(lines[0]).toContain('404');
      expect(lines[1]).toContain('gemini-b');
      for (const line of lines) {
        expect(line).not.toContain('AIzaSECRET');
        expect(line).not.toContain('SYSTEM RULES');
        expect(line).not.toContain('network down');
      }
    });
  });

  describe('logs why a call gave nothing', () => {
    it("logs an empty answer with the model and Gemini's finish reason", async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      generateContent.mockResolvedValue({ text: '', candidates: [{ finishReason: 'MAX_TOKENS' }] });
      await new GeminiLlmClient(models, ['gemini-a']).generate(REQUEST).catch(() => undefined);

      const lines = warn.mock.calls.map(([line]) => String(line));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('gemini-a');
      expect(lines[0]).toContain('MAX_TOKENS');
    });

    it('logs a timeout with the model that did not answer', async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      generateContent.mockImplementation(() => new Promise<GeminiResponse>(() => undefined));
      const outcome = new GeminiLlmClient(models, ['gemini-a', 'gemini-b'], 50)
        .generate(REQUEST)
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(51);
      await outcome;

      const lines = warn.mock.calls.map(([line]) => String(line));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('gemini-a');
      expect(lines[0]).toMatch(/time|did not answer/i);
    });
  });
});
