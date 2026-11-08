import type { ProcessSample } from '@my-resume/api-models';

/** The charts show the last 2 minutes. */
export const WINDOW_SECONDS = 120;
/** The server keeps 5 minutes of 1-second samples. */
export const MAX_SAMPLES = 300;

/**
 * Union of two sample lists by `ts` (the incoming sample wins), sorted oldest first, keeping the
 * newest `max`. Ticks can arrive around a history ack, and a reconnect re-sends overlapping
 * samples, so every source goes through here.
 */
export function mergeSamples(
  window: ProcessSample[],
  incoming: ProcessSample[],
  max = MAX_SAMPLES,
): ProcessSample[] {
  const byTs = new Map<string, ProcessSample>();
  for (const sample of [...window, ...incoming]) byTs.set(sample.ts, sample);
  const sorted = [...byTs.values()].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return sorted.slice(Math.max(0, sorted.length - max));
}

/** The newest sample of a window (oldest first). */
export function newest(window: ProcessSample[]): ProcessSample | undefined {
  return window[window.length - 1];
}

/** The `ts` to pass as `since`: the newest sample's. Undefined = ask for everything. */
export function lastTs(window: ProcessSample[]): string | undefined {
  return newest(window)?.ts;
}

/**
 * The samples of the last `seconds`, measured from the newest sample's `ts` (the server's clock,
 * never the browser's, so a skewed clock can't empty the charts): (newest - seconds, newest].
 */
export function withinSeconds(window: ProcessSample[], seconds: number): ProcessSample[] {
  const latest = newest(window);
  if (!latest) return [];
  const from = Date.parse(latest.ts) - seconds * 1000;
  return window.filter((s) => Date.parse(s.ts) > from);
}
