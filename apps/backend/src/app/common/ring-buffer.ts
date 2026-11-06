/**
 * Fixed-capacity FIFO: once full, each push overwrites the oldest item. O(1) push, no reallocation.
 * Used for the process metrics history (300 samples); the logs live tail will reuse it.
 */
export class RingBuffer<T> {
  private readonly items: T[] = [];
  /** Index of the oldest item once the buffer is full. */
  private head = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('RingBuffer capacity must be a positive integer');
    }
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    if (this.items.length < this.capacity) {
      this.items.push(item);
      return;
    }
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
  }

  /** A copy, oldest first. */
  toArray(): T[] {
    return [...this.items.slice(this.head), ...this.items.slice(0, this.head)];
  }
}
