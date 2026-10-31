/** `part / whole × 100` with one decimal (half up), computed from integers to avoid floating-point drift. */
export function percent(part: number, whole: number): number {
  return Math.round((part * 1000) / whole) / 10;
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole seconds between two instants. */
export function secondsBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 1000);
}
