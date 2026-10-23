import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHighlightLabelsAndSkills1792736353500 implements MigrationInterface {
  name = 'AddHighlightLabelsAndSkills1792736353500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "highlight_skill" ("highlightId" uuid NOT NULL, "skillId" uuid NOT NULL, CONSTRAINT "PK_ddcb22636e101c7e30b4e89199b" PRIMARY KEY ("highlightId", "skillId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a24eaf16ed9762df39fc0a58bd" ON "highlight_skill"  ("highlightId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a62e19e301920386c7a63ed7b" ON "highlight_skill"  ("skillId") `,
    );
    await queryRunner.query(`ALTER TABLE "highlight" ADD "labels" jsonb NOT NULL DEFAULT '{}'`);
    await queryRunner.query(
      `ALTER TABLE "highlight_skill" ADD CONSTRAINT "FK_a24eaf16ed9762df39fc0a58bd9" FOREIGN KEY ("highlightId") REFERENCES "highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "highlight_skill" ADD CONSTRAINT "FK_2a62e19e301920386c7a63ed7b1" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "highlight_skill" DROP CONSTRAINT "FK_2a62e19e301920386c7a63ed7b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "highlight_skill" DROP CONSTRAINT "FK_a24eaf16ed9762df39fc0a58bd9"`,
    );
    await queryRunner.query(`ALTER TABLE "highlight" DROP COLUMN "labels"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2a62e19e301920386c7a63ed7b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a24eaf16ed9762df39fc0a58bd"`);
    await queryRunner.query(`DROP TABLE "highlight_skill"`);
  }
}
