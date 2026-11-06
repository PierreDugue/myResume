import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('is empty at first', () => {
    const buffer = new RingBuffer<number>(3);
    expect(buffer.size).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('keeps every item, oldest first, while under capacity', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    expect(buffer.size).toBe(2);
    expect(buffer.toArray()).toEqual([1, 2]);
  });

  it('holds exactly `capacity` items when full', () => {
    const buffer = new RingBuffer<number>(3);
    [1, 2, 3].forEach((n) => buffer.push(n));
    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([1, 2, 3]);
  });

  it('drops the oldest items once over capacity, keeping the order', () => {
    const buffer = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => buffer.push(n));
    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
  });

  it('wraps around many times', () => {
    const buffer = new RingBuffer<number>(3);
    for (let n = 1; n <= 10; n++) buffer.push(n);
    expect(buffer.toArray()).toEqual([8, 9, 10]);
  });

  it('returns a copy: changing it does not change the buffer', () => {
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.toArray().push(99);
    expect(buffer.toArray()).toEqual([1]);
  });

  it('works with a capacity of 1', () => {
    const buffer = new RingBuffer<string>(1);
    buffer.push('a');
    buffer.push('b');
    expect(buffer.toArray()).toEqual(['b']);
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses a capacity of %s', (capacity) => {
    expect(() => new RingBuffer(capacity)).toThrow();
  });
});
