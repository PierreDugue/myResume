/**
 * Open connections per key (the visitor IP), capped (docs/api-contract.md, Real-time: at most 200
 * per IP). A key is forgotten when its count drops to 0, so the map only holds open connections.
 */
export class ConnectionLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly cap = 200) {}

  /** How many keys have open connections. */
  get keys(): number {
    return this.counts.size;
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  canAcquire(key: string): boolean {
    return this.count(key) < this.cap;
  }

  tryAcquire(key: string): boolean {
    if (!this.canAcquire(key)) return false;
    this.counts.set(key, this.count(key) + 1);
    return true;
  }

  release(key: string): void {
    const count = this.count(key);
    if (count <= 1) this.counts.delete(key);
    else this.counts.set(key, count - 1);
  }
}
