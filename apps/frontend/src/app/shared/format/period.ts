const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2022-09-01` → `Sep 2022`. Reads the string directly: no Date, so no time-zone shift. */
export function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  return `${MONTHS[Number(month) - 1] ?? ''} ${year}`.trim();
}

/** `Sep 2022 – Nov 2025`, or `May 2026 – Present` when there is no end date. */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return '';
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;
}
