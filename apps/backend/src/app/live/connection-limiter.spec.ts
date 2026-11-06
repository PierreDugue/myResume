import { ConnectionLimiter } from './connection-limiter';

describe('ConnectionLimiter (open connections per key, capped)', () => {
  it('acquires up to the cap, then refuses', () => {
    const limiter = new ConnectionLimiter(2);
    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(false);
    expect(limiter.count('a')).toBe(2);
  });

  it('counts each key separately', () => {
    const limiter = new ConnectionLimiter(1);
    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('b')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(false);
  });

  it('frees a slot on release', () => {
    const limiter = new ConnectionLimiter(1);
    limiter.tryAcquire('a');
    limiter.release('a');
    expect(limiter.tryAcquire('a')).toBe(true);
  });

  it('tells whether a key can still acquire, without acquiring', () => {
    const limiter = new ConnectionLimiter(1);
    expect(limiter.canAcquire('a')).toBe(true);
    expect(limiter.count('a')).toBe(0);
    limiter.tryAcquire('a');
    expect(limiter.canAcquire('a')).toBe(false);
  });

  it('forgets a key whose count drops to 0 (no unbounded growth)', () => {
    const limiter = new ConnectionLimiter(5);
    for (let i = 0; i < 1000; i++) {
      limiter.tryAcquire(`ip-${i}`);
      limiter.release(`ip-${i}`);
    }
    expect(limiter.keys).toBe(0);
  });

  it('ignores the release of a key it does not hold (never goes negative)', () => {
    const limiter = new ConnectionLimiter(1);
    limiter.release('ghost');
    expect(limiter.count('ghost')).toBe(0);
    expect(limiter.keys).toBe(0);
    expect(limiter.tryAcquire('ghost')).toBe(true);
    expect(limiter.tryAcquire('ghost')).toBe(false);
  });

  it('defaults to 200 connections per key', () => {
    const limiter = new ConnectionLimiter();
    for (let i = 0; i < 200; i++) expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(false);
  });
});
