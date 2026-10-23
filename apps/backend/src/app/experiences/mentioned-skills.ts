/**
 * Ids of the skills whose name appears in `message` as a whole word (case-sensitive, so "git" or
 * "angular" as plain words don't count), in the order of `skills`. Used to tag existing highlights
 * with their technologies.
 */
export function mentionedSkills(message: string, skills: { id: string; name: string }[]): string[] {
  return skills
    .filter((s) => {
      const name = s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`).test(message);
    })
    .map((s) => s.id);
}
