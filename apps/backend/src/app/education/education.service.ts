import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Education } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { applyOrder, nextSortOrder } from '../common/ordering';
import { CreateEducationDto, toEducation, UpdateEducationDto } from './dto/education.dto';
import { EducationEntity } from './entities/education.entity';

@Injectable()
export class EducationService {
  constructor(
    @InjectRepository(EducationEntity) private readonly education: Repository<EducationEntity>,
  ) {}

  async list(): Promise<Education[]> {
    return (await this.education.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } })).map(
      toEducation,
    );
  }

  async create(dto: CreateEducationDto): Promise<Education> {
    const entity = this.education.create({
      school: dto.school,
      degree: dto.degree,
      field: dto.field ?? null,
      location: dto.location ?? null,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      description: dto.description ?? null,
      sortOrder: await nextSortOrder(this.education.manager, EducationEntity),
    });
    return toEducation(await this.education.save(entity));
  }

  async update(id: string, dto: UpdateEducationDto): Promise<Education> {
    const entity = await this.findOrFail(id);
    const merged = Object.assign(
      entity,
      Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)),
    );
    if (merged.endDate !== null && merged.endDate < merged.startDate) {
      throw new BadRequestException(["endDate can't be before startDate"]);
    }
    return toEducation(await this.education.save(merged));
  }

  async remove(id: string): Promise<void> {
    await this.education.remove(await this.findOrFail(id));
  }

  reorder(ids: string[]): Promise<void> {
    return applyOrder(this.education.manager, EducationEntity, ids);
  }

  private async findOrFail(id: string): Promise<EducationEntity> {
    const entity = await this.education.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Education ${id} not found`);
    return entity;
  }
}
