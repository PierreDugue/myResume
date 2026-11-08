export interface MessageRateLimiterOptions {
  /** Messages allowed per window (default 20). */
  limit?: number;
  /** Window length in ms (default 1000). */
  windowMs?: number;
  /** Monotonic time in ms. */
  now: () => number;
}

/**
 * Fixed-window message limiter for one connection (docs/api-contract.md, Real-time: at most 20
 * messages per second). The window starts at the first message after the previous one ended.
 */
export class MessageRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private windowStart = Number.NEGATIVE_INFINITY;
  private count = 0;

  constructor({ limit = 20, windowMs = 1000, now }: MessageRateLimiterOptions) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** true if the message may go through (and counts it), false if it must be dropped. */
  tryConsume(): boolean {
    const now = this.now();
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count >= this.limit) return false;
    this.count++;
    return true;
  }
}
