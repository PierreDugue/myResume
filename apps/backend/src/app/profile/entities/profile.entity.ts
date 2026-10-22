import type { ProfileLink } from '@my-resume/api-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** The single profile row (see ProfileService). */
@Entity('profile')
export class ProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 200 })
  headline!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'boolean', default: false })
  showPhone!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({ type: 'boolean', default: false })
  openToRelocation!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  links!: ProfileLink[];

  @Column({ type: 'text', nullable: true })
  interests!: string | null;

  @Column({ type: 'smallint', nullable: true })
  yearsInIt!: number | null;

  @Column({ type: 'smallint', nullable: true })
  yearsOfAngular!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
