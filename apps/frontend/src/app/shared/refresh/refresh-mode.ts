/** How a dashboard stays up to date: not at all, polling at an interval, or streamed (live). */
export type RefreshMode = 'off' | '5s' | '30s' | '1m' | 'live';

/** In the order of the picker. */
export const REFRESH_MODES: readonly RefreshMode[] = ['off', '5s', '30s', '1m', 'live'];

const POLL_INTERVALS_MS: Partial<Record<RefreshMode, number>> = {
  '5s': 5_000,
  '30s': 30_000,
  '1m': 60_000,
};

/** The `?refresh=` value of the URL; anything unknown means the default, `live`. */
export function parseRefreshMode(value: unknown): RefreshMode {
  return REFRESH_MODES.find((mode) => mode === value) ?? 'live';
}

/** Polling interval of a mode, or null for the modes that don't poll (`off`, `live`). */
export function pollIntervalMs(mode: RefreshMode): number | null {
  return POLL_INTERVALS_MS[mode] ?? null;
}
