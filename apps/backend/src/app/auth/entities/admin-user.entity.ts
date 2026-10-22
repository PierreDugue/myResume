import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** The single admin account (see docs/api-contract.md, Auth). */
@Entity('admin_user')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stored lowercased and trimmed. */
  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  /** bcrypt hash; never returned by the API. */
  @Column({ type: 'varchar', length: 100 })
  passwordHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
