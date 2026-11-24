import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.validation';

/** Injection token: `true` when the server has a `GEMINI_API_KEY` (the assistant can be offered). */
export const ASSISTANT_CONFIGURED = Symbol('ASSISTANT_CONFIGURED');

/**
 * The one rule for "the assistant is configured": a non-blank validated `GEMINI_API_KEY`. Used by
 * `assistantConfiguredProvider` and the `LLM_CLIENT` factory, so they can't disagree.
 */
export function geminiApiKey(config: ConfigService<AppEnv, true>): string | null {
  const key = config.get('GEMINI_API_KEY', { infer: true }).trim();
  return key === '' ? null : key;
}

/** Read once at startup. */
export const assistantConfiguredProvider: Provider = {
  provide: ASSISTANT_CONFIGURED,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppEnv, true>): boolean => geminiApiKey(config) !== null,
};
