import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PublicPageId } from '@my-resume/api-models';
import { assistantResumeFixture } from '../../testing/resume.fixture';
import { CLOCK } from '../common/clock';
import { PreferencesService } from '../preferences/preferences.service';
import { ResumeService } from '../resume/resume.service';
import { AssistantService } from './assistant.service';
import { LLM_CLIENT, LlmClient, LlmError, LlmResult } from './llm/llm-client';
import { AssistantUsageService } from './usage/assistant-usage.service';

const USAGE = { inputTokens: 900, outputTokens: 40 };
const answerJson = (value: object): LlmResult => ({ text: JSON.stringify(value), usage: USAGE });

describe('AssistantService.ask', () => {
  let enabled: boolean;
  let pages: Partial<Record<PublicPageId, boolean>>;
  const preferences = {
    isAssistantEnabled: vi.fn(async () => enabled),
    isPageEnabled: vi.fn(async (id: PublicPageId) => pages[id] ?? true),
  };
  const resume = { get: vi.fn(async () => assistantResumeFixture()) };
  const usage = { hasBudget: vi.fn(), record: vi.fn() };
  const llm = { generate: vi.fn<LlmClient['generate']>() };

  async function service(client: LlmClient | null = llm): Promise<AssistantService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: PreferencesService, useValue: preferences },
        { provide: ResumeService, useValue: resume },
        { provide: AssistantUsageService, useValue: usage },
        { provide: LLM_CLIENT, useValue: client },
        { provide: CLOCK, useValue: { now: () => new Date('2026-10-22T10:00:00Z') } },
      ],
    }).compile();
    return moduleRef.get(AssistantService);
  }

  beforeEach(() => {
    enabled = true;
    pages = {};
    vi.clearAllMocks();
    usage.hasBudget.mockResolvedValue(true);
    usage.record.mockResolvedValue(undefined);
    llm.generate.mockResolvedValue(answerJson({ answer: 'Acme.' }));
  });

  describe('refusals (the LLM is never called)', () => {
    it('answers 404 "The assistant is disabled" when the switch is off', async () => {
      enabled = false;
      const error = await (await service()).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe('The assistant is disabled');
      expect(llm.generate).not.toHaveBeenCalled();
      expect(usage.record).not.toHaveBeenCalled();
    });

    it('checks the switch before the key and the budget', async () => {
      enabled = false;
      usage.hasBudget.mockResolvedValue(false);
      const error = await (await service(null)).ask('Where?').catch((e: unknown) => e);
      expect((error as NotFoundException).message).toBe('The assistant is disabled');
      expect(usage.hasBudget).not.toHaveBeenCalled();
    });

    it('answers 404 "The assistant is not configured" when there is no LLM client', async () => {
      const error = await (await service(null)).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe('The assistant is not configured');
      expect(usage.hasBudget).not.toHaveBeenCalled();
    });

    it('answers 503 when the monthly budget is used up', async () => {
      usage.hasBudget.mockResolvedValue(false);
      const error = await (await service()).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).message).toBe(
        'The assistant has reached its monthly limit',
      );
      expect(llm.generate).not.toHaveBeenCalled();
      expect(usage.record).not.toHaveBeenCalled();
    });
  });

  describe('a successful answer', () => {
    it('sends the resume and the question to the LLM, with at most 800 output tokens', async () => {
      await (await service()).ask('Where did Ada work?');

      expect(llm.generate).toHaveBeenCalledTimes(1);
      const request = llm.generate.mock.calls[0][0];
      expect(request.maxOutputTokens).toBe(800);
      expect(request.systemInstruction).toContain('Acme');
      expect(request.systemInstruction).toContain('Shipped the billing engine.');
      expect(request.systemInstruction).not.toContain('Where did Ada work?');
      expect(request.userMessage).toContain('Where did Ada work?');
      expect(request.responseSchema).toBeTypeOf('object');
    });

    it('returns the answer and a checked Explore suggestion, and records the usage', async () => {
      llm.generate.mockResolvedValue(
        answerJson({ answer: ' Acme and Globex. ', exploreQuery: '{type="experience"}' }),
      );
      expect(await (await service()).ask('Where?')).toEqual({
        answer: 'Acme and Globex.',
        explore: { query: '{type="experience"}', matches: 2 },
      });
      expect(usage.record).toHaveBeenCalledExactlyOnceWith({ usage: USAGE, failed: false });
    });

    it.each([
      ['none is proposed', { answer: 'x' }],
      ['it is invalid', { answer: 'x', exploreQuery: '{company=' }],
      ['it matches nothing', { answer: 'x', exploreQuery: '{company="Nowhere"}' }],
    ])('has no Explore suggestion when %s', async (_name, output) => {
      llm.generate.mockResolvedValue(answerJson(output));
      expect(await (await service()).ask('Where?')).toEqual({ answer: 'x', explore: null });
    });

    it('has no Explore suggestion when the Explore page is disabled', async () => {
      pages = { explore: false };
      llm.generate.mockResolvedValue(
        answerJson({ answer: 'x', exploreQuery: '{type="experience"}' }),
      );
      expect(await (await service()).ask('Where?')).toEqual({ answer: 'x', explore: null });
      expect(usage.record).toHaveBeenCalledWith({ usage: USAGE, failed: false });
    });
  });

  describe('failures answer 502 "The assistant could not answer"', () => {
    const MESSAGE = 'The assistant could not answer';

    it('when the LLM fails, recording the failure and the tokens it reported', async () => {
      const spent = { inputTokens: 700, outputTokens: 5 };
      llm.generate.mockRejectedValue(new LlmError('timeout', spent));
      const error = await (await service()).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      expect((error as BadGatewayException).message).toBe(MESSAGE);
      expect(usage.record).toHaveBeenCalledExactlyOnceWith({ usage: spent, failed: true });
    });

    it('when the LLM throws something else, recording the failure with no tokens', async () => {
      llm.generate.mockRejectedValue(new Error('socket hang up'));
      const error = await (await service()).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      expect(usage.record).toHaveBeenCalledExactlyOnceWith({
        usage: { inputTokens: 0, outputTokens: 0 },
        failed: true,
      });
    });

    it.each([
      ['not JSON', 'Sure, here you go'],
      ['an empty answer', '{"answer":"  "}'],
    ])('when the output is %s, recording the failure with the tokens used', async (_name, text) => {
      llm.generate.mockResolvedValue({ text, usage: USAGE });
      const error = await (await service()).ask('Where?').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      expect((error as BadGatewayException).message).toBe(MESSAGE);
      expect(usage.record).toHaveBeenCalledExactlyOnceWith({ usage: USAGE, failed: true });
    });
  });

  it('never writes the question to the logs, whether it works or fails', async () => {
    const question = 'SECRET-QUESTION-TEXT-12345';
    const writes: string[] = [];
    const capture = (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    };
    const spies = [
      vi.spyOn(process.stdout, 'write').mockImplementation(capture),
      vi.spyOn(process.stderr, 'write').mockImplementation(capture),
      vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void capture(a.join(' '))),
      vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void capture(a.join(' '))),
      vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void capture(a.join(' '))),
    ];
    try {
      const asking = await service();
      await asking.ask(question);
      llm.generate.mockRejectedValue(new LlmError('upstream failure'));
      await asking.ask(question).catch(() => undefined);
      llm.generate.mockResolvedValue({ text: 'not json', usage: USAGE });
      await asking.ask(question).catch(() => undefined);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
    expect(writes.join('')).not.toContain(question);
  });
});
