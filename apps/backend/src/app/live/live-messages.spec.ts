import { parseSubscribeMetrics } from './live-messages';

describe('parseSubscribeMetrics', () => {
  it('accepts {} (the whole buffer)', () => {
    expect(parseSubscribeMetrics({})).toEqual({});
  });

  it('accepts a valid `since` and converts it to epoch ms', () => {
    expect(parseSubscribeMetrics({ since: '2026-11-05T10:00:01.000Z' })).toEqual({
      sinceMs: Date.UTC(2026, 10, 5, 10, 0, 1),
    });
  });

  it('treats an explicitly undefined `since` as absent', () => {
    expect(parseSubscribeMetrics({ since: undefined })).toEqual({});
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', '2026-11-05T10:00:00Z'],
    ['a number', 42],
    ['an array', []],
    ['an array holding a request', [{}]],
  ])('refuses %s: the payload must be an object', (_case, payload) => {
    expect(parseSubscribeMetrics(payload)).toEqual({ error: expect.any(String) });
  });

  it('refuses an object that is not a plain object', () => {
    expect(parseSubscribeMetrics(new Date())).toEqual({ error: expect.any(String) });
  });

  it('refuses unknown keys with a generic message', () => {
    const result = parseSubscribeMetrics({ since: '2026-11-05T10:00:00Z', limit: 5 });
    expect(result).toEqual({ error: 'Only "since" is allowed' });
  });

  it('does not echo an unknown key name in the error message', () => {
    const key = '<script>alert(1)</script>';
    const result = parseSubscribeMetrics({ [key]: 1 });
    expect(result).toEqual({ error: expect.any(String) });
    expect('error' in result && result.error).not.toContain('script');
  });

  it('refuses a `since` with a time but no offset', () => {
    expect(parseSubscribeMetrics({ since: '2026-11-05T10:00:00' })).toEqual({
      error: expect.stringContaining('since'),
    });
  });

  it('accepts a date-only `since` (midnight UTC)', () => {
    expect(parseSubscribeMetrics({ since: '2026-11-05' })).toEqual({
      sinceMs: Date.UTC(2026, 10, 5),
    });
  });

  it.each([
    ['not a date', 'yesterday'],
    ['longer than 40 characters', `2026-11-05T10:00:00.${'0'.repeat(30)}Z`],
    ['a number', 1730800000000],
    ['null', null],
    ['an empty string', ''],
  ])('refuses a `since` that is %s', (_case, since) => {
    expect(parseSubscribeMetrics({ since })).toEqual({ error: expect.stringContaining('since') });
  });

  it('never echoes the payload back in the error message', () => {
    const since = '<script>alert(1)</script>';
    const result = parseSubscribeMetrics({ since });
    expect('error' in result && result.error).not.toContain(since);
  });
});
