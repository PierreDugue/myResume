import { MigrationInterface, QueryRunner } from 'typeorm';
import { mentionedSkills } from '../../experiences/mentioned-skills';

/**
 * Tags each existing highlight that has no skills yet with the skills its message names (see
 * `mentionedSkills`), so Explore's `{tech="..."}` works on the content entered before highlights
 * had skills. The admin can change the tags afterwards. `down` does nothing: after this, the tags
 * belong to the admin.
 */
export class TagHighlightSkills1792736365265 implements MigrationInterface {
  name = 'TagHighlightSkills1792736365265';

  public async up(db: QueryRunner): Promise<void> {
    const skills: { id: string; name: string }[] = await db.query(
      `SELECT id, name FROM skill ORDER BY "sortOrder", "createdAt"`,
    );
    const highlights: { id: string; message: string }[] = await db.query(
      `SELECT h.id, h.message FROM highlight h
       WHERE NOT EXISTS (SELECT 1 FROM highlight_skill hs WHERE hs."highlightId" = h.id)`,
    );
    for (const h of highlights) {
      for (const skillId of mentionedSkills(h.message, skills)) {
        await db.query(`INSERT INTO highlight_skill ("highlightId", "skillId") VALUES ($1, $2)`, [
          h.id,
          skillId,
        ]);
      }
    }
  }

  public async down(): Promise<void> {
    // Nothing to undo: the tags are content now.
  }
}
