import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSitePreferences1793466829834 implements MigrationInterface {
  name = 'AddSitePreferences1793466829834';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "site_preferences" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "pages" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a84ede10eef2dc2b32f73cfbe9" PRIMARY KEY ("id"))`,
    );
    // Constant expression: every row has the same index key, so at most one row can exist.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_site_preferences_singleton" ON "site_preferences" ((true))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_site_preferences_singleton"`);
    await queryRunner.query(`DROP TABLE "site_preferences"`);
  }
}
