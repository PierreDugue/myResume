const ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** `2026-10-31T14:02:11Z` → `2026-10-31 14:02 UTC`. Reads the string: no Date, no time-zone shift. */
export function formatTimestamp(iso: string): string {
  const match = ISO.exec(iso);
  return match ? `${match[1]} ${match[2]} UTC` : iso;
}
