import { REFRESH_MODES, parseRefreshMode, pollIntervalMs } from './refresh-mode';

describe('parseRefreshMode', () => {
  it.each(['off', '5s', '30s', '1m', 'live'] as const)('accepts "%s"', (mode) => {
    expect(parseRefreshMode(mode)).toBe(mode);
  });

  it.each([undefined, null, '', 'LIVE', '10s', 'poll', 5, true, ['5s'], { mode: 'off' }])(
    'falls back to live for %j',
    (value) => {
      expect(parseRefreshMode(value)).toBe('live');
    },
  );

  it('lists the modes in the order of the picker', () => {
    expect(REFRESH_MODES).toEqual(['off', '5s', '30s', '1m', 'live']);
  });
});

describe('pollIntervalMs', () => {
  it.each([
    ['5s', 5_000],
    ['30s', 30_000],
    ['1m', 60_000],
  ] as const)('polls every %s', (mode, ms) => {
    expect(pollIntervalMs(mode)).toBe(ms);
  });

  it.each(['off', 'live'] as const)('has no polling interval for %s', (mode) => {
    expect(pollIntervalMs(mode)).toBeNull();
  });
});
