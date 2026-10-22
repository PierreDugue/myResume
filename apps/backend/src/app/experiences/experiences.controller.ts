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
import type { Experience } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { ReorderDto } from '../common/reorder.dto';
import { CreateExperienceDto, UpdateExperienceDto } from './dto/experience.dto';
import { ExperiencesService } from './experiences.service';

@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiences: ExperiencesService) {}

  @Public()
  @Get()
  list(): Promise<Experience[]> {
    return this.experiences.list();
  }

  @Post()
  create(@Body() dto: CreateExperienceDto): Promise<Experience> {
    return this.experiences.create(dto);
  }

  @Put('order')
  @HttpCode(204)
  reorder(@Body() dto: ReorderDto): Promise<void> {
    return this.experiences.reorder(dto.ids);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<Experience> {
    return this.experiences.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.experiences.remove(id);
  }
}
