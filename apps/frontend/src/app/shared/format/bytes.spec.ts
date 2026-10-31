import { formatBytes } from './bytes';

describe('formatBytes (1 kB = 1000 bytes, as Angular budgets count)', () => {
  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(512340)).toBe('512.3 kB');
    expect(formatBytes(1000)).toBe('1.0 kB');
    expect(formatBytes(999_949)).toBe('999.9 kB');
  });

  it('formats small sizes in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatBytes(999_950)).toBe('1.0 MB');
  });
});
