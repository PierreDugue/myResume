import { isISO8601 } from 'class-validator';

/** Longest accepted `since` (an ISO timestamp from `toISOString()` has 24 characters). */
export const SINCE_MAX_LENGTH = 40;

export const SINCE_MESSAGE =
  'since must be an ISO 8601 timestamp of at most 40 characters, with an offset (Z or ±hh:mm) when it has a time';

/** A time part (`T` or a space separator) must end with `Z` or `±hh:mm`. */
const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The `since` cursor rule (docs/api-contract.md, Site metrics), shared by the HTTP query DTO and
 * the socket's `subscribe:metrics`: a string of at most 40 characters holding a real ISO 8601 date
 * that `Date` can read. A value with a time part must carry its offset (`Z` or `±hh:mm`), because
 * `Date.parse` would read it as server-local time; a date-only value is midnight UTC. Returns its
 * epoch ms, or null when it is invalid.
 */
export function parseSince(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > SINCE_MAX_LENGTH) {
    return null;
  }
  // The length is checked first, so the validator never sees long input.
  if (!isISO8601(value, { strict: true })) return null;
  if (/[T\s]/.test(value) && !OFFSET_SUFFIX.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
