import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** [depth, name, start, end (null = ongoing), note, skill names], in outline order. */
type SeedSpan = [number, string, string, string | null, string, string[]];

/**
 * The phases of this site, from its git history (commit dates), as the spans of the seeded
 * "pierre-o11y" project. Runs once, and only if that project exists and has no spans yet; then the
 * admin owns them. Unknown skill names are skipped. `down` does nothing, like the other seeds.
 */
export const SITE_SPANS: SeedSpan[] = [
  [
    0,
    'Specification',
    '2026-10-21',
    '2026-10-21',
    'Product spec and API contract: the resume as an observability platform.',
    [],
  ],
  [
    0,
    'Foundations',
    '2026-10-22',
    '2026-10-22',
    'Nx monorepo with Angular and NestJS apps, PostgreSQL and Docker, plus the Claude Code agents and skills that build the rest.',
    ['NX', 'TypeScript', 'Angular', 'NestJS', 'Claude', 'Claude skills'],
  ],
  [
    0,
    'Features',
    '2026-10-22',
    null,
    'One feature at a time: contract first, then backend and frontend, test-first.',
    [],
  ],
  [
    1,
    'Auth',
    '2026-10-22',
    '2026-10-22',
    'A single admin with peppered bcrypt hashes and JWT; login page and route guards.',
    ['NestJS', 'Angular'],
  ],
  [
    1,
    'Admin content',
    '2026-10-22',
    '2026-10-22',
    'Create, edit and reorder the resume content; the public resume bundle and the plain view.',
    ['NestJS', 'Angular'],
  ],
  [
    1,
    'Career Overview dashboard',
    '2026-10-23',
    '2026-10-23',
    'Stats, timeline, skills over time, impact and heatmap panels, calculated in a shared library.',
    ['Angular', 'NestJS', 'Cypress'],
  ],
  [
    1,
    'Explore (logs)',
    '2026-10-23',
    '2026-10-23',
    'A LogQL-style query language with autocomplete, written test-first; regexes run with RE2.',
    ['Angular', 'NestJS', 'Cypress'],
  ],
  [
    1,
    'Traces and service map',
    '2026-10-23',
    null,
    'This trace, and the graph of technologies, jobs and projects.',
    ['Angular', 'NestJS'],
  ],
];

export class SeedProjectSpans1792744955583 implements MigrationInterface {
  name = 'SeedProjectSpans1792744955583';

  public async up(db: QueryRunner): Promise<void> {
    const [project] = await db.query(`SELECT id FROM project WHERE slug = 'pierre-o11y'`);
    if (!project) return;
    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM project_span WHERE "projectId" = $1`,
      [project.id],
    );
    if (count > 0) return;

    const skills: { id: string; name: string }[] = await db.query(`SELECT id, name FROM skill`);
    const skillId = new Map(skills.map((s) => [s.name, s.id]));
    const lastAtDepth: string[] = [];
    for (const [order, [depth, name, start, end, note, skillNames]] of SITE_SPANS.entries()) {
      const id = randomUUID();
      lastAtDepth[depth] = id;
      await db.query(
        `INSERT INTO project_span (id, "projectId", "parentId", name, "startDate", "endDate", note, "sortOrder")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, project.id, depth > 0 ? lastAtDepth[depth - 1] : null, name, start, end, note, order],
      );
      for (const skill of skillNames) {
        const sid = skillId.get(skill);
        if (!sid) continue;
        await db.query(
          `INSERT INTO project_span_skill ("projectSpanId", "skillId") VALUES ($1, $2)`,
          [id, sid],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Nothing to undo: the spans are content now.
  }
}
