import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CLOCK, Clock } from '../../common/clock';
import type { AppEnv } from '../../config/env.validation';
import type { LlmUsage } from '../llm/llm-client';
import { AssistantUsageEntity } from './assistant-usage.entity';

/**
 * The assistant's monthly totals: questions, failures and tokens, one row per UTC month. The
 * budget is a soft cap: questions already past `hasBudget()` still record their tokens.
 */
@Injectable()
export class AssistantUsageService {
  constructor(
    @InjectRepository(AssistantUsageEntity)
    private readonly usage: Repository<AssistantUsageEntity>,
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** True while this month's input + output tokens are under ASSISTANT_MONTHLY_TOKEN_LIMIT. */
  async hasBudget(): Promise<boolean> {
    const row = await this.usage.findOneBy({ month: this.month() });
    const spent = row ? row.inputTokens + row.outputTokens : 0;
    return spent < this.config.get('ASSISTANT_MONTHLY_TOKEN_LIMIT', { infer: true });
  }

  /** Adds one question (and a failure if it failed) and its tokens, in one atomic upsert. */
  async record(outcome: { usage: LlmUsage; failed: boolean }): Promise<void> {
    await this.usage.query(
      `INSERT INTO "assistant_usage" ("month", "questions", "failures", "inputTokens", "outputTokens")
       VALUES ($1, 1, $2, $3, $4)
       ON CONFLICT ("month") DO UPDATE
       SET "questions" = "assistant_usage"."questions" + EXCLUDED."questions",
           "failures" = "assistant_usage"."failures" + EXCLUDED."failures",
           "inputTokens" = "assistant_usage"."inputTokens" + EXCLUDED."inputTokens",
           "outputTokens" = "assistant_usage"."outputTokens" + EXCLUDED."outputTokens",
           "updatedAt" = now()`,
      [this.month(), outcome.failed ? 1 : 0, outcome.usage.inputTokens, outcome.usage.outputTokens],
    );
  }

  /** The current UTC month as its first day, `YYYY-MM-01`. */
  private month(): string {
    return `${this.clock.now().toISOString().slice(0, 7)}-01`;
  }
}
