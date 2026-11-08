import type { ProcessMetricsHistory, ProcessSample } from '@my-resume/api-models';

/** The inspector shows the last 8 entries. */
export const STREAM_LOG_MAX = 8;
const PREVIEW_MAX = 160;

/** Sent ↑ to the server, received ↓ from it, a connection event •, or an HTTP call. */
export type StreamDirection = 'sent' | 'received' | 'lifecycle' | 'http';

export interface StreamLogEntry {
  /** Client time, `HH:MM:SS.mmm`. */
  time: string;
  direction: StreamDirection;
  symbol: string;
  event: string;
  preview: string;
}

const SYMBOLS: Record<StreamDirection, string> = {
  sent: '↑',
  received: '↓',
  lifecycle: '•',
  http: 'HTTP',
};

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** The browser's local time, `HH:MM:SS.mmm`. */
export function formatClientTime(date: Date): string {
  const hms = [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => pad(n)).join(':');
  return `${hms}.${pad(date.getMilliseconds(), 3)}`;
}

/** Compact JSON, cut with an ellipsis so that it is at most `max` characters long. */
export function previewJson(value: unknown, max = PREVIEW_MAX): string {
  const json = JSON.stringify(value) ?? '';
  return json.length <= max ? json : `${json.slice(0, max - 1)}…`;
}

/** `HH:MM:SS` of an ISO timestamp, read from the string (UTC, whatever the browser time zone). */
const clock = (ts: string) => ts.slice(11, 19);

/** `300 samples, 14:02:11 → 14:07:10`: what an HTTP poll or a history replay carried. */
export function summariseSamples(samples: ProcessSample[]): string {
  if (samples.length === 0) return '0 samples';
  const first = clock(samples[0].ts);
  if (samples.length === 1) return `1 sample, ${first}`;
  return `${samples.length} samples, ${first} → ${clock(samples[samples.length - 1].ts)}`;
}

export function summariseHistory(history: ProcessMetricsHistory): string {
  return `history: ${summariseSamples(history.samples)}`;
}

export function streamEntry(
  now: Date,
  direction: StreamDirection,
  event: string,
  preview: string,
): StreamLogEntry {
  return { time: formatClientTime(now), direction, symbol: SYMBOLS[direction], event, preview };
}

/** Newest first, keeping `max` entries. */
export function appendEntry(
  log: StreamLogEntry[],
  entry: StreamLogEntry,
  max = STREAM_LOG_MAX,
): StreamLogEntry[] {
  return [entry, ...log].slice(0, max);
}
