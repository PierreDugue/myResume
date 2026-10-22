import { BadRequestException } from '@nestjs/common';
import { assertSameIds } from './ordering';

describe('assertSameIds (reorder requests)', () => {
  const existing = ['a', 'b', 'c'];

  it('accepts every existing id exactly once, in any order', () => {
    expect(() => assertSameIds(existing, ['c', 'a', 'b'])).not.toThrow();
  });

  it.each([
    ['a missing id', ['a', 'b']],
    ['a repeated id', ['a', 'b', 'b']],
    ['an unknown id', ['a', 'b', 'c', 'd']],
    ['an unknown id replacing one', ['a', 'b', 'x']],
  ])('rejects %s with 400', (_case, ids) => {
    expect(() => assertSameIds(existing, ids)).toThrow(BadRequestException);
  });
});
