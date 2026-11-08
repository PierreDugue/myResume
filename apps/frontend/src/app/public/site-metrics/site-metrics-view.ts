import type { ProcessSample } from '@my-resume/api-models';
import { formatDuration } from '../../shared/format/duration';
import { newest, withinSeconds } from './sample-window';

/** Pure mappers from the samples to what the Site metrics panels display. */

export interface StatView {
  label: string;
  display: string;
  hint: string | null;
}

/** The table alternative of a chart: one row per sample, newest first. */
export interface TableView {
  columns: string[];
  rows: TableRow[];
}

export interface TableRow {
  /** The sample's `ts`: unique, unlike the displayed time (second precision), so rows can be tracked. */
  key: string;
  /** The time first, then one cell per column. */
  cells: string[];
}

/** `1.50` → `1`, `4.2500001` → `4.25`: at most `decimals`, no trailing zeros. */
const num = (n: number, decimals = 2) => String(Number(n.toFixed(decimals)));

/** The uptime of the latest sample, plus the whole seconds since it was received. */
export function liveUptimeSeconds(
  latestUptimeSeconds: number,
  receivedAtMs: number,
  nowMs: number,
): number {
  return latestUptimeSeconds + Math.max(0, Math.floor((nowMs - receivedAtMs) / 1000));
}

/** GC pauses (count and total ms) in the 60 s ending at the newest sample. */
export function gcLastMinute(window: ProcessSample[]): { count: number; ms: number } {
  let count = 0;
  let ms = 0;
  for (const { gc } of withinSeconds(window, 60)) {
    count += gc.minorCount + gc.majorCount;
    ms += gc.minorMs + gc.majorMs;
  }
  return { count, ms: Number(ms.toFixed(2)) };
}

export function processStats(window: ProcessSample[], uptimeSeconds: number): StatView[] {
  const latest = newest(window);
  if (!latest) return [];
  const gc = gcLastMinute(window);
  return [
    { label: 'Uptime', display: formatDuration(uptimeSeconds), hint: 'since the backend started' },
    {
      label: 'Event loop lag (p99)',
      display: `${num(latest.eventLoopLagMs.p99)} ms`,
      hint: `p50 ${num(latest.eventLoopLagMs.p50)} ms`,
    },
    {
      label: 'Heap used',
      display: `${num(latest.memoryMb.heapUsed, 1)} MB`,
      hint: `of ${num(latest.memoryMb.heapTotal, 1)} MB`,
    },
    {
      label: 'RSS',
      display: `${num(latest.memoryMb.rss, 1)} MB`,
      hint: 'memory held by the process',
    },
    { label: 'CPU', display: `${num(latest.cpuPercent, 1)} %`, hint: 'of one core' },
    {
      label: 'GC pauses, last minute',
      display: String(gc.count),
      hint: `${num(gc.ms)} ms paused`,
    },
  ];
}

function table(
  window: ProcessSample[],
  columns: string[],
  cells: (s: ProcessSample) => string[],
): TableView {
  return {
    columns: ['Time (UTC)', ...columns],
    rows: [...window]
      .reverse()
      .map((s) => ({ key: s.ts, cells: [s.ts.slice(11, 19), ...cells(s)] })),
  };
}

export function eventLoopTable(window: ProcessSample[]): TableView {
  return table(window, ['p50 (ms)', 'p99 (ms)'], (s) => [
    num(s.eventLoopLagMs.p50),
    num(s.eventLoopLagMs.p99),
  ]);
}

export function memoryTable(window: ProcessSample[]): TableView {
  return table(window, ['RSS (MB)', 'Heap total (MB)', 'Heap used (MB)'], (s) => [
    num(s.memoryMb.rss, 1),
    num(s.memoryMb.heapTotal, 1),
    num(s.memoryMb.heapUsed, 1),
  ]);
}

export function cpuTable(window: ProcessSample[]): TableView {
  return table(window, ['CPU (% of one core)'], (s) => [num(s.cpuPercent, 1)]);
}

export function gcTable(window: ProcessSample[]): TableView {
  return table(window, ['Minor (count)', 'Minor (ms)', 'Major (count)', 'Major (ms)'], (s) => [
    String(s.gc.minorCount),
    num(s.gc.minorMs),
    String(s.gc.majorCount),
    num(s.gc.majorMs),
  ]);
}
