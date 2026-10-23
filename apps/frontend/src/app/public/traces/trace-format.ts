const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 day", "23 days", "4 months", "2.5 years". */
export function formatDuration(days: number): string {
  if (days < 60) return days === 1 ? '1 day' : `${days} days`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/** "Oct 22, 2026", read from the `YYYY-MM-DD` string (no Date, so no time zone shift). */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export interface TimeTick {
  /** 0..1 on the time axis. */
  offset: number;
  label: string;
}

/**
 * Ticks for a time axis of `days` days starting on `start`: at each quarter, labelled by day,
 * month or year depending on the length, skipping a tick that repeats the previous label.
 */
export function timeTicks(start: string, days: number): TimeTick[] {
  const [y, m, d] = start.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d);
  const label = (offsetDays: number) => {
    const date = new Date(startMs + offsetDays * 86_400_000);
    const month = MONTHS[date.getUTCMonth()];
    if (days <= 62) return `${month} ${date.getUTCDate()}`;
    if (days <= 3 * 366) return `${month} ${date.getUTCFullYear()}`;
    return String(date.getUTCFullYear());
  };
  const ticks: TimeTick[] = [];
  for (const fraction of [0, 0.25, 0.5, 0.75]) {
    const day = Math.floor(fraction * days);
    const tick = { offset: days > 0 ? day / days : 0, label: label(day) };
    if (ticks[ticks.length - 1]?.label !== tick.label) ticks.push(tick);
  }
  return ticks;
}
