/** Injectable "now", so date-based results (current job, default range) are testable. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Today as `YYYY-MM-DD` (UTC). */
export function today(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}
