/** URL-safe slug: lowercase ASCII letters and digits separated by single dashes. */
export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
