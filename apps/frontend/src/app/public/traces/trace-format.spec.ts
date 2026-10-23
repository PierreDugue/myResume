import { formatDate, formatDuration, timeTicks } from './trace-format';

describe('trace formatting', () => {
  it('formats durations in days, months or years', () => {
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(3)).toBe('3 days');
    expect(formatDuration(59)).toBe('59 days');
    expect(formatDuration(61)).toBe('2 months');
    expect(formatDuration(31 * 23)).toBe('23 months');
    expect(formatDuration(365 * 3)).toBe('3.0 years');
  });

  it('formats dates from the string, without time zones', () => {
    expect(formatDate('2026-10-22')).toBe('Oct 22, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('places ticks on the time axis, labelled by day for short traces', () => {
    expect(timeTicks('2026-10-21', 4)).toEqual([
      { offset: 0, label: 'Oct 21' },
      { offset: 0.25, label: 'Oct 22' },
      { offset: 0.5, label: 'Oct 23' },
      { offset: 0.75, label: 'Oct 24' },
    ]);
    // Two days: one tick per day, never the same label twice.
    expect(timeTicks('2026-10-21', 2)).toEqual([
      { offset: 0, label: 'Oct 21' },
      { offset: 0.5, label: 'Oct 22' },
    ]);
  });

  it('labels by month for longer traces and by year for very long ones', () => {
    expect(timeTicks('2025-01-01', 365).map((t) => t.label)).toEqual([
      'Jan 2025',
      'Apr 2025',
      'Jul 2025',
      'Oct 2025',
    ]);
    expect(timeTicks('2015-06-01', 365 * 8).map((t) => t.label)).toEqual([
      '2015',
      '2017',
      '2019',
      '2021',
    ]);
  });
});
