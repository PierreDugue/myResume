import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { slugify } from '../../common/slug';
import {
  SEED_DATE,
  SEED_EDUCATION,
  SEED_EXPERIENCES,
  SEED_PROFILE,
  SEED_PROJECTS,
  SEED_SKILLS,
} from '../seed/resume.seed';

/**
 * Loads the initial resume content (database/seed/resume.seed.ts), once, into an empty database.
 * If any content already exists it does nothing. `down` does nothing either: after seeding, the
 * content belongs to the admin.
 */
export class SeedResume1792669998403 implements MigrationInterface {
  name = 'SeedResume1792669998403';

  public async up(db: QueryRunner): Promise<void> {
    const [{ count }] = await db.query(
      `SELECT (SELECT count(*) FROM profile) + (SELECT count(*) FROM skill) + (SELECT count(*) FROM experience) AS count`,
    );
    if (Number(count) > 0) return;

    const p = SEED_PROFILE;
    await db.query(
      `INSERT INTO profile ("fullName", headline, summary, email, phone, "showPhone", location, "openToRelocation", "avatarUrl", links, interests, "yearsInIt", "yearsOfAngular")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        p.fullName,
        p.headline,
        p.summary,
        p.email,
        p.phone,
        p.showPhone,
        p.location,
        p.openToRelocation,
        p.avatarUrl,
        JSON.stringify(p.links),
        p.interests,
        p.yearsInIt,
        p.yearsOfAngular,
      ],
    );

    const skillIds = new Map<string, string>();
    for (const [index, [name, category]] of SEED_SKILLS.entries()) {
      const id = randomUUID();
      skillIds.set(name, id);
      await db.query(
        `INSERT INTO skill (id, name, slug, category, level, "sortOrder") VALUES ($1, $2, $3, $4, NULL, $5)`,
        [id, name, slugify(name), category, index],
      );
    }
    const skill = (name: string): string => {
      const id = skillIds.get(name);
      if (!id) throw new Error(`Seed: unknown skill "${name}"`);
      return id;
    };

    for (const [index, e] of SEED_EXPERIENCES.entries()) {
      const id = randomUUID();
      await db.query(
        `INSERT INTO experience (id, company, role, location, "startDate", "endDate", summary, "sortOrder")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, e.company, e.role, e.location, e.startDate, e.endDate, e.summary, index],
      );
      for (const name of e.skills) {
        await db.query(`INSERT INTO experience_skill ("experienceId", "skillId") VALUES ($1, $2)`, [
          id,
          skill(name),
        ]);
      }
      for (const [order, h] of e.highlights.entries()) {
        await db.query(
          `INSERT INTO highlight ("experienceId", date, level, message, impact, "sortOrder") VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            e.endDate ?? SEED_DATE,
            h.level,
            h.message,
            h.impact ? JSON.stringify(h.impact) : null,
            order,
          ],
        );
      }
    }

    for (const [index, ed] of SEED_EDUCATION.entries()) {
      await db.query(
        `INSERT INTO education (school, degree, field, location, "startDate", "endDate", "sortOrder")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ed.school, ed.degree, ed.field, ed.location, ed.startDate, ed.endDate, index],
      );
    }

    for (const [index, pr] of SEED_PROJECTS.entries()) {
      const id = randomUUID();
      await db.query(
        `INSERT INTO project (id, slug, title, description, "startDate", "sortOrder") VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, pr.slug, pr.title, pr.description, pr.startDate, index],
      );
      for (const name of pr.skills) {
        await db.query(`INSERT INTO project_skill ("projectId", "skillId") VALUES ($1, $2)`, [
          id,
          skill(name),
        ]);
      }
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty: seeded rows are regular content once loaded.
  }
}
