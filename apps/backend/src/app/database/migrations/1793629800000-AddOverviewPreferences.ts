import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverviewPreferences1793629800000 implements MigrationInterface {
  name = 'AddOverviewPreferences1793629800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The default makes this safe on live data: the existing row (if any) gets an empty group.
    await queryRunner.query(
      `ALTER TABLE "site_preferences" ADD "overview" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "site_preferences" DROP COLUMN "overview"`);
  }
}
