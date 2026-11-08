import { MessageRateLimiter } from './message-rate-limiter';

describe('MessageRateLimiter (fixed window, per connection)', () => {
  let now: number;
  const limiter = () => new MessageRateLimiter({ limit: 20, windowMs: 1000, now: () => now });

  beforeEach(() => {
    now = 50_000;
  });

  it('allows 20 messages in a window and refuses the 21st', () => {
    const l = limiter();
    for (let i = 0; i < 20; i++) expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(false);
    expect(l.tryConsume()).toBe(false);
  });

  it('allows messages again once the window has passed', () => {
    const l = limiter();
    for (let i = 0; i < 20; i++) l.tryConsume();
    now += 999;
    expect(l.tryConsume()).toBe(false);
    now += 1; // 1000 ms after the window started
    expect(l.tryConsume()).toBe(true);
  });

  it('starts the window at the first message, not at construction', () => {
    const l = limiter();
    now += 5000;
    for (let i = 0; i < 20; i++) expect(l.tryConsume()).toBe(true);
    now += 500;
    expect(l.tryConsume()).toBe(false);
  });

  it('does not count refused messages towards the next window', () => {
    const l = limiter();
    for (let i = 0; i < 100; i++) l.tryConsume();
    now += 1000;
    for (let i = 0; i < 20; i++) expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(false);
  });

  it('defaults to 20 messages per second', () => {
    const l = new MessageRateLimiter({ now: () => now });
    for (let i = 0; i < 20; i++) expect(l.tryConsume()).toBe(true);
    expect(l.tryConsume()).toBe(false);
    now += 1000;
    expect(l.tryConsume()).toBe(true);
  });
});
