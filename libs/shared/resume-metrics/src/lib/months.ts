/** Calendar months as integers (year * 12 + month - 1), read straight from `YYYY-MM-DD` strings. */
export function monthIndex(isoDate: string): number {
  const [year, month] = isoDate.split('-').map(Number);
  return year * 12 + (month - 1);
}

export function yearOfMonth(index: number): number {
  return Math.floor(index / 12);
}

/** Every month from `start` to `end` inclusive; a missing end means "until `today`". */
export function monthsBetween(start: string, end: string | null, today: string): number[] {
  const first = monthIndex(start);
  const last = monthIndex(end ?? today);
  const months: number[] = [];
  for (let m = first; m <= last; m++) months.push(m);
  return months;
}

/** Years with one decimal (months / 12). */
export function toYears(months: number): number {
  return Math.round((months / 12) * 10) / 10;
}
