import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContent1792669952176 implements MigrationInterface {
  name = 'CreateContent1792669952176';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "education" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "school" character varying(120) NOT NULL, "degree" character varying(120) NOT NULL, "field" character varying(120), "location" character varying(120), "startDate" date NOT NULL, "endDate" date, "description" text, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bf3d38701b3030a8ad634d43bd6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "skill" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "slug" character varying(80) NOT NULL, "category" character varying(60) NOT NULL, "level" smallint, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_604e22347c14fc37e29ea38660c" UNIQUE ("slug"), CONSTRAINT "PK_a0d33334424e64fb78dc3ce7196" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "highlight" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" date NOT NULL, "level" character varying(20) NOT NULL, "message" text NOT NULL, "impact" jsonb, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "experienceId" uuid NOT NULL, CONSTRAINT "PK_0f4191998a1e1e8f8455f1d4adb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d923b35a61ecf8cee4c3388e77" ON "highlight"  ("experienceId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "experience" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "company" character varying(120) NOT NULL, "role" character varying(120) NOT NULL, "location" character varying(120), "startDate" date NOT NULL, "endDate" date, "summary" text, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e8d5a534100e1b17ee2efa429a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "profile" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "fullName" character varying(120) NOT NULL, "headline" character varying(200) NOT NULL, "summary" text NOT NULL, "email" character varying(254) NOT NULL, "phone" character varying(40), "showPhone" boolean NOT NULL DEFAULT false, "location" character varying(120), "openToRelocation" boolean NOT NULL DEFAULT false, "avatarUrl" character varying(500), "links" jsonb NOT NULL DEFAULT '[]', "interests" text, "yearsInIt" smallint, "yearsOfAngular" smallint, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "project" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" character varying(80) NOT NULL, "title" character varying(120) NOT NULL, "description" text NOT NULL, "url" character varying(500), "repoUrl" character varying(500), "imageUrl" character varying(500), "startDate" date, "endDate" date, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6fce32ddd71197807027be6ad38" UNIQUE ("slug"), CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "experience_skill" ("experienceId" uuid NOT NULL, "skillId" uuid NOT NULL, CONSTRAINT "PK_6b29e5ab8de7d40ab47e2ca6b2b" PRIMARY KEY ("experienceId", "skillId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_635d9edddd363460b46bea1d68" ON "experience_skill"  ("experienceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4eed9eb6188b176eff561e59f1" ON "experience_skill"  ("skillId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_skill" ("projectId" uuid NOT NULL, "skillId" uuid NOT NULL, CONSTRAINT "PK_3fa8d58669bcdbebcf9f8f56a69" PRIMARY KEY ("projectId", "skillId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_960e313c4196524222f7dfd2a8" ON "project_skill"  ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97af292ff0eaa431e132d50764" ON "project_skill"  ("skillId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "highlight" ADD CONSTRAINT "FK_d923b35a61ecf8cee4c3388e772" FOREIGN KEY ("experienceId") REFERENCES "experience"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "experience_skill" ADD CONSTRAINT "FK_635d9edddd363460b46bea1d686" FOREIGN KEY ("experienceId") REFERENCES "experience"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "experience_skill" ADD CONSTRAINT "FK_4eed9eb6188b176eff561e59f15" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_skill" ADD CONSTRAINT "FK_960e313c4196524222f7dfd2a87" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_skill" ADD CONSTRAINT "FK_97af292ff0eaa431e132d507649" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_skill" DROP CONSTRAINT "FK_97af292ff0eaa431e132d507649"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_skill" DROP CONSTRAINT "FK_960e313c4196524222f7dfd2a87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "experience_skill" DROP CONSTRAINT "FK_4eed9eb6188b176eff561e59f15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "experience_skill" DROP CONSTRAINT "FK_635d9edddd363460b46bea1d686"`,
    );
    await queryRunner.query(
      `ALTER TABLE "highlight" DROP CONSTRAINT "FK_d923b35a61ecf8cee4c3388e772"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_97af292ff0eaa431e132d50764"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_960e313c4196524222f7dfd2a8"`);
    await queryRunner.query(`DROP TABLE "project_skill"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4eed9eb6188b176eff561e59f1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_635d9edddd363460b46bea1d68"`);
    await queryRunner.query(`DROP TABLE "experience_skill"`);
    await queryRunner.query(`DROP TABLE "project"`);
    await queryRunner.query(`DROP TABLE "profile"`);
    await queryRunner.query(`DROP TABLE "experience"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d923b35a61ecf8cee4c3388e77"`);
    await queryRunner.query(`DROP TABLE "highlight"`);
    await queryRunner.query(`DROP TABLE "skill"`);
    await queryRunner.query(`DROP TABLE "education"`);
  }
}
