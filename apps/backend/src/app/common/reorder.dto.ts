import type { ReorderRequest } from '@my-resume/api-models';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ReorderDto implements ReorderRequest {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];
}
