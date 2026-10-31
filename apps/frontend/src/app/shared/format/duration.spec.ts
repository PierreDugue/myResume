import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(372)).toBe('6 min 12 s');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(3599)).toBe('59 min 59 s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(371.6)).toBe('6 min 12 s');
    expect(formatDuration(59.6)).toBe('1 min');
  });
});
