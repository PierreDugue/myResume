import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AssistantAnswer } from '@my-resume/api-models';
import { logLabels } from '@my-resume/resume-metrics';
import { CLOCK, Clock, today } from '../common/clock';
import { PreferencesService } from '../preferences/preferences.service';
import { ResumeService } from '../resume/resume.service';
import { AssistantOutputError, parseAssistantOutput } from './assistant-output';
import {
  ASSISTANT_RESPONSE_SCHEMA,
  buildSystemInstruction,
  toUserMessage,
} from './assistant-prompt';
import { toExploreSuggestion } from './explore-suggestion';
import { LLM_CLIENT, LlmError, type LlmClient, type LlmResult } from './llm/llm-client';
import { buildResumeContext } from './resume-context';
import { AssistantUsageService } from './usage/assistant-usage.service';

const MAX_OUTPUT_TOKENS = 800;
const COULD_NOT_ANSWER = 'The assistant could not answer';

/**
 * "Ask my resume": one grounded, single-turn question (docs/api-contract.md, Assistant). Every
 * refusal happens before the LLM is called. The question is never logged or stored: failures are
 * logged by error class only, and usage is kept as monthly totals.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly preferences: PreferencesService,
    private readonly resume: ResumeService,
    private readonly usage: AssistantUsageService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async ask(question: string): Promise<AssistantAnswer> {
    if (!(await this.preferences.isAssistantEnabled())) {
      throw new NotFoundException('The assistant is disabled');
    }
    if (this.llm === null) throw new NotFoundException('The assistant is not configured');
    if (!(await this.usage.hasBudget())) {
      throw new ServiceUnavailableException('The assistant has reached its monthly limit');
    }

    const resume = await this.resume.get();
    const day = today(this.clock);
    const systemInstruction = buildSystemInstruction({
      name: resume.profile?.fullName ?? null,
      context: buildResumeContext(resume, day),
      labels: logLabels(resume),
    });

    let result: LlmResult;
    try {
      result = await this.llm.generate({
        systemInstruction,
        userMessage: toUserMessage(question),
        responseSchema: ASSISTANT_RESPONSE_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
    } catch (error) {
      const usage = error instanceof LlmError ? error.usage : { inputTokens: 0, outputTokens: 0 };
      await this.usage.record({ usage, failed: true });
      this.logger.warn(`The LLM call failed (${errorClass(error)})`);
      throw new BadGatewayException(COULD_NOT_ANSWER);
    }

    let output: ReturnType<typeof parseAssistantOutput>;
    try {
      output = parseAssistantOutput(result.text);
    } catch (error) {
      if (!(error instanceof AssistantOutputError)) throw error;
      await this.usage.record({ usage: result.usage, failed: true });
      this.logger.warn('The LLM output does not match the response schema');
      throw new BadGatewayException(COULD_NOT_ANSWER);
    }

    await this.usage.record({ usage: result.usage, failed: false });
    const explore = (await this.preferences.isPageEnabled('explore'))
      ? toExploreSuggestion({ query: output.exploreQuery, resume, today: day })
      : null;
    return { answer: output.answer, explore };
  }
}

/** The error's class name only: messages may quote the request. */
function errorClass(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
