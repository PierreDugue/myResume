import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * The single row of site preferences (see PreferencesService). No row means "all defaults".
 * One column per group of settings; a new group gets its own column and migration.
 */
@Entity('site_preferences')
export class SitePreferencesEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Only the page flags the admin has set (page id → visible); missing ids use the default. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  pages!: Record<string, boolean>;

  /** Only the overview settings the admin has set (e.g. `skillsOverTime`: skill ids); missing keys use the default. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  overview!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
