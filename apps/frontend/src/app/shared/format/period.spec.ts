import { formatMonth, formatPeriod } from './period';

describe('period formatting (no time-zone shifts: dates are plain strings)', () => {
  it('formats a month', () => {
    expect(formatMonth('2022-09-01')).toBe('Sep 2022');
    expect(formatMonth('2025-11-30')).toBe('Nov 2025');
    expect(formatMonth('2011-01-01')).toBe('Jan 2011');
  });

  it('formats a period, with "Present" for a current job', () => {
    expect(formatPeriod('2022-09-01', '2025-11-30')).toBe('Sep 2022 – Nov 2025');
    expect(formatPeriod('2026-05-01', null)).toBe('May 2026 – Present');
  });

  it('returns an empty string without a start date', () => {
    expect(formatPeriod(null, null)).toBe('');
  });
});
