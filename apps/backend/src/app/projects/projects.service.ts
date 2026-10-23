import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Project } from '@my-resume/api-models';
import { spanOutlineErrors, spanParents } from '@my-resume/resume-metrics';
import { EntityManager, Repository } from 'typeorm';
import { rethrowUniqueViolation } from '../common/db-errors';
import { applyOrder, nextSortOrder } from '../common/ordering';
import { slugify } from '../common/slug';
import { SkillsService } from '../skills/skills.service';
import {
  CreateProjectDto,
  ProjectSpanInputDto,
  toProject,
  toSpans,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectSpanEntity } from './entities/project-span.entity';
import { ProjectEntity } from './entities/project.entity';

const RELATIONS = { skills: true, spans: { skills: true } } as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly skills: SkillsService,
  ) {}

  async list(): Promise<Project[]> {
    const rows = await this.projects.find({
      relations: RELATIONS,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toProject);
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const startDate = dto.startDate ?? null;
    const endDate = dto.endDate ?? null;
    assertOutline(dto.spans ?? [], { startDate, endDate });
    const skills = await this.skills.findByIdsOrFail(dto.skillIds);
    const id = await this.projects.manager.transaction(async (tx) => {
      const entity = tx.create(ProjectEntity, {
        slug: dto.slug ?? slugify(dto.title),
        title: dto.title,
        description: dto.description,
        url: dto.url ?? null,
        repoUrl: dto.repoUrl ?? null,
        imageUrl: dto.imageUrl ?? null,
        startDate,
        endDate,
        skills,
        sortOrder: await nextSortOrder(tx, ProjectEntity),
      });
      await this.save(tx, entity);
      await this.replaceSpans(tx, entity, [], dto.spans ?? []);
      return entity.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const entity = await this.findOrFail(id);
    const { skillIds, spans, ...fields } = dto;
    const existing = entity.spans;
    Object.assign(
      entity,
      Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
    );
    if (entity.startDate && entity.endDate && entity.endDate < entity.startDate) {
      throw new BadRequestException(["endDate can't be before startDate"]);
    }
    // New dates must still hold the spans: the new outline, or the existing one.
    assertOutline(spans ?? toSpans(existing), entity);
    if (skillIds !== undefined) entity.skills = await this.skills.findByIdsOrFail(skillIds);

    await this.projects.manager.transaction(async (tx) => {
      await this.save(tx, { ...entity, spans: undefined } as unknown as ProjectEntity);
      if (spans !== undefined) await this.replaceSpans(tx, entity, existing, spans);
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.projects.remove(await this.findOrFail(id));
  }

  reorder(ids: string[]): Promise<void> {
    return applyOrder(this.projects.manager, ProjectEntity, ids);
  }

  private async get(id: string): Promise<Project> {
    return toProject(await this.findOrFail(id));
  }

  private async findOrFail(id: string): Promise<ProjectEntity> {
    const entity = await this.projects.findOne({ where: { id }, relations: RELATIONS });
    if (!entity) throw new NotFoundException(`Project ${id} not found`);
    return entity;
  }

  private async save(tx: EntityManager, entity: ProjectEntity): Promise<ProjectEntity> {
    try {
      return await tx.save(ProjectEntity, entity);
    } catch (error) {
      rethrowUniqueViolation(error, `A project with slug "${entity.slug}" already exists`);
    }
  }

  /**
   * Makes the spans of `project` exactly `inputs`, in that order, with parents worked out from the
   * depths. Inputs with an id update that span (it must belong to this project), the others are
   * created, and spans not listed are deleted, after the kept ones have their new parents.
   */
  private async replaceSpans(
    tx: EntityManager,
    project: ProjectEntity,
    existing: ProjectSpanEntity[],
    inputs: ProjectSpanInputDto[],
  ): Promise<void> {
    const byId = new Map(existing.map((s) => [s.id, s]));
    const keptIds = new Set<string>();
    for (const input of inputs) {
      if (input.id === undefined) continue;
      if (!byId.has(input.id) || keptIds.has(input.id)) {
        throw new BadRequestException(`Span ${input.id} does not belong to this project`);
      }
      keptIds.add(input.id);
    }
    const skills = await this.skills.findByIdsOrFail(inputs.flatMap((i) => i.skillIds ?? []));
    const skillById = new Map(skills.map((s) => [s.id, s]));

    const parents = spanParents(inputs.map((i) => i.depth));
    const saved: ProjectSpanEntity[] = [];
    for (const [index, input] of inputs.entries()) {
      const target = input.id
        ? (byId.get(input.id) as ProjectSpanEntity)
        : tx.create(ProjectSpanEntity);
      const parentIndex = parents[index];
      const parent = parentIndex === null ? null : saved[parentIndex];
      Object.assign(target, {
        project: { id: project.id },
        parent: parent ? { id: parent.id } : null,
        parentId: parent?.id ?? null,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        note: input.note ?? null,
        skills: [...new Set(input.skillIds ?? [])].map((id) => skillById.get(id)),
        sortOrder: index,
      });
      saved.push(await tx.save(ProjectSpanEntity, target));
    }

    const removed = existing.filter((s) => !keptIds.has(s.id));
    if (removed.length > 0)
      await tx.delete(
        ProjectSpanEntity,
        removed.map((s) => s.id),
      );
  }
}

function assertOutline(
  spans: { depth: number; name: string; startDate: string; endDate?: string | null }[],
  project: { startDate: string | null; endDate: string | null },
): void {
  const errors = spanOutlineErrors(
    spans.map((s) => ({ ...s, endDate: s.endDate ?? null })),
    project,
  );
  if (errors.length > 0) throw new BadRequestException(errors);
}
