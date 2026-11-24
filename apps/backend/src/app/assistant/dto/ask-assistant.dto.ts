import type { AskAssistantRequest } from '@my-resume/api-models';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AskAssistantDto implements AskAssistantRequest {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  question!: string;
}
