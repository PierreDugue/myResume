import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One row per UTC month of totals (see AssistantUsageService). Never holds question text. `int`
 * columns: a month counts millions of tokens at most, and they map to numbers (bigint would not).
 */
@Entity('assistant_usage')
@Unique('UQ_assistant_usage_month', ['month'])
@Check('CHK_assistant_usage_month_first_day', `EXTRACT(DAY FROM "month") = 1`)
export class AssistantUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** First day of the month, `YYYY-MM-01`. */
  @Column({ type: 'date' })
  month!: string;

  @Column({ type: 'int', default: 0 })
  questions!: number;

  @Column({ type: 'int', default: 0 })
  failures!: number;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
