import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Skill } from '@my-resume/api-models';
import { In, Not, Repository } from 'typeorm';
import { rethrowUniqueViolation } from '../common/db-errors';
import { applyOrder, nextSortOrder } from '../common/ordering';
import { slugify } from '../common/slug';
import { CreateSkillDto, toSkill, UpdateSkillDto } from './dto/skill.dto';
import { SkillEntity } from './entities/skill.entity';

@Injectable()
export class SkillsService {
  constructor(@InjectRepository(SkillEntity) private readonly skills: Repository<SkillEntity>) {}

  async list(): Promise<Skill[]> {
    const rows = await this.skills.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    return rows.map(toSkill);
  }

  async create(dto: CreateSkillDto): Promise<Skill> {
    await this.assertNameFree(dto.name);
    const entity = this.skills.create({
      name: dto.name,
      slug: dto.slug ?? slugify(dto.name),
      category: dto.category,
      level: dto.level ?? null,
      sortOrder: await nextSortOrder(this.skills.manager, SkillEntity),
    });
    return toSkill(await this.save(entity));
  }

  async update(id: string, dto: UpdateSkillDto): Promise<Skill> {
    const entity = await this.findOrFail(id);
    if (dto.name !== undefined) await this.assertNameFree(dto.name, id);
    Object.assign(entity, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.level !== undefined && { level: dto.level }),
    });
    return toSkill(await this.save(entity));
  }

  async remove(id: string): Promise<void> {
    await this.skills.remove(await this.findOrFail(id));
  }

  reorder(ids: string[]): Promise<void> {
    return applyOrder(this.skills.manager, SkillEntity, ids);
  }

  /** For experiences and projects: loads the skills, or 400 if an id is unknown. */
  async findByIdsOrFail(ids: string[] | undefined): Promise<SkillEntity[]> {
    const unique = [...new Set(ids ?? [])];
    if (unique.length === 0) return [];
    const found = await this.skills.findBy({ id: In(unique) });
    if (found.length !== unique.length) throw new BadRequestException('Unknown skill ids');
    return found;
  }

  private async findOrFail(id: string): Promise<SkillEntity> {
    const entity = await this.skills.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Skill ${id} not found`);
    return entity;
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const taken = await this.skills
      .createQueryBuilder('s')
      .where('lower(s.name) = lower(:name)', { name })
      .andWhere(exceptId ? { id: Not(exceptId) } : '1=1')
      .getExists();
    if (taken) throw new ConflictException(`A skill named "${name}" already exists`);
  }

  private async save(entity: SkillEntity): Promise<SkillEntity> {
    try {
      return await this.skills.save(entity);
    } catch (error) {
      rethrowUniqueViolation(error, `A skill with slug "${entity.slug}" already exists`);
    }
  }
}
