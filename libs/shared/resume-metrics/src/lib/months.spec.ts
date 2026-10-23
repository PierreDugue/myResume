import { monthIndex, monthsBetween, yearOfMonth } from './months';

describe('month arithmetic', () => {
  it('numbers calendar months', () => {
    expect(monthIndex('2022-09-01')).toBe(2022 * 12 + 8);
    expect(monthIndex('2022-09-30')).toBe(monthIndex('2022-09-01'));
    expect(yearOfMonth(monthIndex('2025-12-31'))).toBe(2025);
  });

  it('lists every month from start to end, inclusive', () => {
    const months = monthsBetween('2022-09-01', '2022-12-15', '2026-10-22');
    expect(months).toHaveLength(4);
    expect(months[0]).toBe(monthIndex('2022-09-01'));
    expect(months[3]).toBe(monthIndex('2022-12-01'));
  });

  it('runs to the current month when there is no end date', () => {
    expect(monthsBetween('2026-05-01', null, '2026-10-22')).toHaveLength(6);
  });

  it('is empty when the end is before the start', () => {
    expect(monthsBetween('2026-05-01', '2026-01-01', '2026-10-22')).toEqual([]);
  });
});
