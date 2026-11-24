import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistant1795531871937 implements MigrationInterface {
  name = 'AddAssistant1795531871937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // One row of totals per UTC month (no column can hold question text).
    await queryRunner.query(
      `CREATE TABLE "assistant_usage" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "month" date NOT NULL, "questions" integer NOT NULL DEFAULT '0', "failures" integer NOT NULL DEFAULT '0', "inputTokens" integer NOT NULL DEFAULT '0', "outputTokens" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_assistant_usage_month" UNIQUE ("month"), CONSTRAINT "CHK_assistant_usage_month_first_day" CHECK (EXTRACT(DAY FROM "month") = 1), CONSTRAINT "PK_85a2f9b80205c4eba9eba9970c7" PRIMARY KEY ("id"))`,
    );
    // The default makes this safe on live data: a missing `enabled` means disabled.
    await queryRunner.query(
      `ALTER TABLE "site_preferences" ADD "assistant" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "site_preferences" DROP COLUMN "assistant"`);
    await queryRunner.query(`DROP TABLE "assistant_usage"`);
  }
}
