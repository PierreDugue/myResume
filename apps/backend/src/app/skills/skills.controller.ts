import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { Skill } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { ReorderDto } from '../common/reorder.dto';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Public()
  @Get()
  list(): Promise<Skill[]> {
    return this.skills.list();
  }

  @Post()
  create(@Body() dto: CreateSkillDto): Promise<Skill> {
    return this.skills.create(dto);
  }

  /** Declared before `:id` routes of other methods; Express matches by method and path. */
  @Put('order')
  @HttpCode(204)
  reorder(@Body() dto: ReorderDto): Promise<void> {
    return this.skills.reorder(dto.ids);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSkillDto): Promise<Skill> {
    return this.skills.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.skills.remove(id);
  }
}
