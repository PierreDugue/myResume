import type { HighlightLevel, Impact } from '@my-resume/api-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExperienceEntity } from './experience.entity';

/** An achievement of an experience; becomes a log line in Explore (build step 5). */
@Entity('highlight')
export class HighlightEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => ExperienceEntity, (e) => e.highlights, { onDelete: 'CASCADE', nullable: false })
  experience!: ExperienceEntity;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: HighlightLevel;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  impact!: Impact | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
