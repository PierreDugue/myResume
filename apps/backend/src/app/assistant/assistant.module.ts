import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../common/clock';
import { PreferencesModule } from '../preferences/preferences.module';
import { ResumeModule } from '../resume/resume.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { geminiApiKey } from '../config/assistant-configured';
import type { AppEnv } from '../config/env.validation';
import { GeminiLlmClient } from './llm/gemini-llm-client';
import { LLM_CLIENT, type LlmClient } from './llm/llm-client';
import { AssistantUsageEntity } from './usage/assistant-usage.entity';
import { AssistantUsageService } from './usage/assistant-usage.service';

/** "Ask my resume" (docs/api-contract.md, Assistant). Gemini is reached only through LLM_CLIENT. */
@Module({
  imports: [PreferencesModule, ResumeModule, TypeOrmModule.forFeature([AssistantUsageEntity])],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantUsageService,
    { provide: CLOCK, useValue: systemClock },
    {
      // The only place that imports the Gemini SDK. Building the client makes no network call.
      provide: LLM_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): LlmClient | null => {
        const apiKey = geminiApiKey(config);
        const modelIds = config.get('GEMINI_MODEL', { infer: true });
        return apiKey === null
          ? null
          : new GeminiLlmClient(new GoogleGenAI({ apiKey }).models, modelIds);
      },
    },
  ],
})
export class AssistantModule {}
