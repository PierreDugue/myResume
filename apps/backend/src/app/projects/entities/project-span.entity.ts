import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SkillEntity } from '../../skills/entities/skill.entity';
import { ProjectEntity } from './project.entity';

/** A phase or component of a project: a span of its trace (build step 6). */
@Entity('project_span')
export class ProjectSpanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => ProjectEntity, (p) => p.spans, { onDelete: 'CASCADE', nullable: false })
  project!: ProjectEntity;

  /** null = a direct child of the project. Deleting a parent deletes its children. */
  @ManyToOne(() => ProjectSpanEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent!: ProjectSpanEntity | null;

  /** Read without loading the relation. */
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'date' })
  startDate!: string;

  /** null = ongoing. */
  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @ManyToMany(() => SkillEntity)
  @JoinTable({ name: 'project_span_skill' })
  skills!: SkillEntity[];

  /** Position in the outline. */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
