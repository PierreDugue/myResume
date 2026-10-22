import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SkillEntity } from '../../skills/entities/skill.entity';
import { HighlightEntity } from './highlight.entity';

@Entity('experience')
export class ExperienceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  company!: string;

  @Column({ type: 'varchar', length: 120 })
  role!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({ type: 'date' })
  startDate!: string;

  /** null = current job. */
  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @ManyToMany(() => SkillEntity)
  @JoinTable({ name: 'experience_skill' })
  skills!: SkillEntity[];

  @OneToMany(() => HighlightEntity, (h) => h.experience)
  highlights!: HighlightEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
