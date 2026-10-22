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
import type { Education } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { ReorderDto } from '../common/reorder.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import { EducationService } from './education.service';

@Controller('education')
export class EducationController {
  constructor(private readonly education: EducationService) {}

  @Public()
  @Get()
  list(): Promise<Education[]> {
    return this.education.list();
  }

  @Post()
  create(@Body() dto: CreateEducationDto): Promise<Education> {
    return this.education.create(dto);
  }

  @Put('order')
  @HttpCode(204)
  reorder(@Body() dto: ReorderDto): Promise<void> {
    return this.education.reorder(dto.ids);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEducationDto,
  ): Promise<Education> {
    return this.education.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.education.remove(id);
  }
}
