import { formatTimestamp } from './timestamp';

describe('formatTimestamp (reads the string: no Date, so no time-zone shift)', () => {
  it('formats an ISO timestamp as date, time and UTC', () => {
    expect(formatTimestamp('2026-10-31T14:02:11Z')).toBe('2026-10-31 14:02 UTC');
    expect(formatTimestamp('2026-01-05T00:00:00.000Z')).toBe('2026-01-05 00:00 UTC');
  });

  it('returns the text unchanged when it is not an ISO timestamp', () => {
    expect(formatTimestamp('yesterday')).toBe('yesterday');
  });
});
