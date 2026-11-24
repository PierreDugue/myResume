import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AssistantAnswer } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { AssistantService } from './assistant.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** 10 questions per 10 minutes per visitor IP. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post('ask')
  @HttpCode(200)
  ask(@Body() body: AskAssistantDto): Promise<AssistantAnswer> {
    return this.assistant.ask(body.question);
  }
}
