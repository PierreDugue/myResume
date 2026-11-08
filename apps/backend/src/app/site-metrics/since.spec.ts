import { parseSince, SINCE_MAX_LENGTH } from './since';

describe('parseSince (the `since` cursor rule, shared by HTTP and the socket)', () => {
  it('allows at most 40 characters', () => {
    expect(SINCE_MAX_LENGTH).toBe(40);
  });

  it.each([
    ['2026-11-05T10:00:00.000Z', Date.UTC(2026, 10, 5, 10, 0, 0, 0)],
    ['2026-11-05T10:00:00Z', Date.UTC(2026, 10, 5, 10, 0, 0)],
    ['2026-11-05T12:00:00+02:00', Date.UTC(2026, 10, 5, 10, 0, 0)],
    ['2026-11-05', Date.UTC(2026, 10, 5)],
    ['2026-11-05T12:00:00-02:30', Date.UTC(2026, 10, 5, 14, 30, 0)],
    ['2026-11-05T10:00Z', Date.UTC(2026, 10, 5, 10, 0, 0)],
    ['1970-01-01T00:00:00.000Z', 0],
  ])('parses the ISO 8601 timestamp %s to epoch ms', (value, expected) => {
    expect(parseSince(value)).toBe(expected);
  });

  it.each([
    ['an empty string', ''],
    ['garbage', 'not-a-date'],
    ['an impossible date', '2026-02-30T00:00:00Z'],
    ['an out-of-range hour', '2026-11-05T25:00:00Z'],
    ['a non-ISO date', 'Thu Nov 05 2026'],
    ['digits only', '1730800000000'],
    ['an ISO week date the Date parser cannot read', '2026-W45-4'],
  ])('refuses %s', (_case, value) => {
    expect(parseSince(value)).toBeNull();
  });

  it.each([
    ['a time without an offset', '2026-11-05T10:00:00'],
    ['a time with fractions but no offset', '2026-11-05T10:00:00.000'],
    ['a time with a space separator and no offset', '2026-11-05 10:00:00'],
    ['an offset without the colon', '2026-11-05T10:00:00+0200'],
    ['an hour-only offset', '2026-11-05T10:00:00+02'],
    ['a lowercase z', '2026-11-05T10:00:00z'],
  ])('refuses %s (Date would read it as server-local time)', (_case, value) => {
    expect(parseSince(value)).toBeNull();
  });

  it('refuses a value longer than 40 characters, even a valid timestamp', () => {
    const long = `2026-11-05T10:00:00.${'0'.repeat(30)}Z`;
    expect(long.length).toBeGreaterThan(40);
    expect(parseSince(long)).toBeNull();
  });

  it('accepts exactly 40 characters when it is a valid timestamp', () => {
    const value = `2026-11-05T10:00:00.${'0'.repeat(19)}Z`;
    expect(value).toHaveLength(40);
    expect(parseSince(value)).toBe(Date.UTC(2026, 10, 5, 10, 0, 0));
  });

  it.each([null, undefined, 42, {}, ['2026-11-05'], true])('refuses the non-string %j', (value) => {
    expect(parseSince(value)).toBeNull();
  });
});
