import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Project } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { rethrowUniqueViolation } from '../common/db-errors';
import { applyOrder, nextSortOrder } from '../common/ordering';
import { slugify } from '../common/slug';
import { SkillsService } from '../skills/skills.service';
import { CreateProjectDto, toProject, UpdateProjectDto } from './dto/project.dto';
import { ProjectEntity } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly skills: SkillsService,
  ) {}

  async list(): Promise<Project[]> {
    const rows = await this.projects.find({
      relations: { skills: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toProject);
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const entity = this.projects.create({
      slug: dto.slug ?? slugify(dto.title),
      title: dto.title,
      description: dto.description,
      url: dto.url ?? null,
      repoUrl: dto.repoUrl ?? null,
      imageUrl: dto.imageUrl ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      skills: await this.skills.findByIdsOrFail(dto.skillIds),
      sortOrder: await nextSortOrder(this.projects.manager, ProjectEntity),
    });
    return toProject(await this.save(entity));
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const entity = await this.findOrFail(id);
    const { skillIds, ...fields } = dto;
    Object.assign(
      entity,
      Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
    );
    if (skillIds !== undefined) entity.skills = await this.skills.findByIdsOrFail(skillIds);
    if (entity.startDate && entity.endDate && entity.endDate < entity.startDate) {
      throw new BadRequestException(["endDate can't be before startDate"]);
    }
    return toProject(await this.save(entity));
  }

  async remove(id: string): Promise<void> {
    await this.projects.remove(await this.findOrFail(id));
  }

  reorder(ids: string[]): Promise<void> {
    return applyOrder(this.projects.manager, ProjectEntity, ids);
  }

  private async findOrFail(id: string): Promise<ProjectEntity> {
    const entity = await this.projects.findOne({ where: { id }, relations: { skills: true } });
    if (!entity) throw new NotFoundException(`Project ${id} not found`);
    return entity;
  }

  private async save(entity: ProjectEntity): Promise<ProjectEntity> {
    try {
      return await this.projects.save(entity);
    } catch (error) {
      rethrowUniqueViolation(error, `A project with slug "${entity.slug}" already exists`);
    }
  }
}
