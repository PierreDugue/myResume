import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Experience, Impact } from '@my-resume/api-models';
import { EntityManager, Repository } from 'typeorm';
import { applyOrder, nextSortOrder } from '../common/ordering';
import { SkillsService } from '../skills/skills.service';
import {
  CreateExperienceDto,
  HighlightInputDto,
  toExperience,
  UpdateExperienceDto,
} from './dto/experience.dto';
import { ExperienceEntity } from './entities/experience.entity';
import { HighlightEntity } from './entities/highlight.entity';

const RELATIONS = { skills: true, highlights: true } as const;

@Injectable()
export class ExperiencesService {
  constructor(
    @InjectRepository(ExperienceEntity) private readonly experiences: Repository<ExperienceEntity>,
    private readonly skills: SkillsService,
  ) {}

  async list(): Promise<Experience[]> {
    const rows = await this.experiences.find({
      relations: RELATIONS,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toExperience);
  }

  async create(dto: CreateExperienceDto): Promise<Experience> {
    const skills = await this.skills.findByIdsOrFail(dto.skillIds);
    const id = await this.experiences.manager.transaction(async (tx) => {
      const entity = tx.create(ExperienceEntity, {
        company: dto.company,
        role: dto.role,
        location: dto.location ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        summary: dto.summary ?? null,
        skills,
        sortOrder: await nextSortOrder(tx, ExperienceEntity),
      });
      await tx.save(entity);
      await this.replaceHighlights(tx, entity, [], dto.highlights ?? []);
      return entity.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateExperienceDto): Promise<Experience> {
    const entity = await this.findOrFail(id);
    const skills =
      dto.skillIds !== undefined ? await this.skills.findByIdsOrFail(dto.skillIds) : undefined;

    const startDate = dto.startDate ?? entity.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : entity.endDate;
    if (endDate !== null && endDate < startDate) {
      throw new BadRequestException(["endDate can't be before startDate"]);
    }

    await this.experiences.manager.transaction(async (tx) => {
      Object.assign(entity, {
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        startDate,
        endDate,
        ...(skills !== undefined && { skills }),
      });
      const { highlights: existing } = entity;
      await tx.save(ExperienceEntity, { ...entity, highlights: undefined });
      if (dto.highlights !== undefined) {
        await this.replaceHighlights(tx, entity, existing, dto.highlights);
      }
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.experiences.remove(await this.findOrFail(id));
  }

  reorder(ids: string[]): Promise<void> {
    return applyOrder(this.experiences.manager, ExperienceEntity, ids);
  }

  private async get(id: string): Promise<Experience> {
    return toExperience(await this.findOrFail(id));
  }

  private async findOrFail(id: string): Promise<ExperienceEntity> {
    const entity = await this.experiences.findOne({ where: { id }, relations: RELATIONS });
    if (!entity) throw new NotFoundException(`Experience ${id} not found`);
    return entity;
  }

  /**
   * Makes the highlights of `experience` exactly `inputs`, in that order: inputs with an id update
   * that highlight (it must belong to this experience), the others are created, and existing
   * highlights not listed are deleted.
   */
  private async replaceHighlights(
    tx: EntityManager,
    experience: ExperienceEntity,
    existing: HighlightEntity[],
    inputs: HighlightInputDto[],
  ): Promise<void> {
    const byId = new Map(existing.map((h) => [h.id, h]));
    const keptIds = new Set<string>();
    for (const input of inputs) {
      if (input.id === undefined) continue;
      if (!byId.has(input.id) || keptIds.has(input.id)) {
        throw new BadRequestException(`Highlight ${input.id} does not belong to this experience`);
      }
      keptIds.add(input.id);
    }

    const removed = existing.filter((h) => !keptIds.has(h.id));
    if (removed.length > 0) await tx.remove(HighlightEntity, removed);

    for (const [index, input] of inputs.entries()) {
      const target = input.id
        ? (byId.get(input.id) as HighlightEntity)
        : tx.create(HighlightEntity);
      Object.assign(target, {
        experience: { id: experience.id },
        date: input.date,
        level: input.level,
        message: input.message,
        impact: normalizeImpact(input.impact),
        sortOrder: index,
      });
      await tx.save(HighlightEntity, target);
    }
  }
}

function normalizeImpact(impact: Impact | null | undefined): Impact | null {
  if (!impact) return null;
  return {
    metric: impact.metric,
    before: impact.before ?? null,
    after: impact.after ?? null,
    changePct: impact.changePct ?? null,
    unit: impact.unit ?? null,
    direction: impact.direction,
  };
}
