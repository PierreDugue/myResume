import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectSpans1792744929736 implements MigrationInterface {
  name = 'AddProjectSpans1792744929736';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_span" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "parentId" uuid, "name" character varying(120) NOT NULL, "startDate" date NOT NULL, "endDate" date, "note" text, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "projectId" uuid NOT NULL, CONSTRAINT "PK_28b751a40daa76188714a75b41e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_893a3069f35994e50e9ae2dcd3" ON "project_span"  ("projectId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_span_skill" ("projectSpanId" uuid NOT NULL, "skillId" uuid NOT NULL, CONSTRAINT "PK_529cddb8d7e9be19d2c20bd1fb5" PRIMARY KEY ("projectSpanId", "skillId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_08fabc7b5f6cdf30709db81333" ON "project_span_skill"  ("projectSpanId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d4c71ad81e0c20a482bc0d7aa" ON "project_span_skill"  ("skillId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span" ADD CONSTRAINT "FK_893a3069f35994e50e9ae2dcd34" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span" ADD CONSTRAINT "FK_ba679474a293221ec1c9808c455" FOREIGN KEY ("parentId") REFERENCES "project_span"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span_skill" ADD CONSTRAINT "FK_08fabc7b5f6cdf30709db81333c" FOREIGN KEY ("projectSpanId") REFERENCES "project_span"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span_skill" ADD CONSTRAINT "FK_9d4c71ad81e0c20a482bc0d7aa3" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_span_skill" DROP CONSTRAINT "FK_9d4c71ad81e0c20a482bc0d7aa3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span_skill" DROP CONSTRAINT "FK_08fabc7b5f6cdf30709db81333c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span" DROP CONSTRAINT "FK_ba679474a293221ec1c9808c455"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_span" DROP CONSTRAINT "FK_893a3069f35994e50e9ae2dcd34"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_9d4c71ad81e0c20a482bc0d7aa"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_08fabc7b5f6cdf30709db81333"`);
    await queryRunner.query(`DROP TABLE "project_span_skill"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_893a3069f35994e50e9ae2dcd3"`);
    await queryRunner.query(`DROP TABLE "project_span"`);
  }
}
