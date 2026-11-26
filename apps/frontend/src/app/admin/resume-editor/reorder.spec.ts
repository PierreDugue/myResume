import { moveItem } from './reorder';

describe('moveItem', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it.each([
    ['b', -1, ['b', 'a', 'c']],
    ['b', 1, ['a', 'c', 'b']],
    ['c', -1, ['a', 'c', 'b']],
    ['a', 1, ['b', 'a', 'c']],
  ] as const)('moves %s by %i to give %j', (id, delta, expected) => {
    expect(moveItem(items, id, delta)).toEqual(expected);
  });

  it.each([
    ['the first item up', 'a', -1],
    ['the last item down', 'c', 1],
    ['an unknown id', 'zzz', 1],
  ] as const)('cannot move %s', (_name, id, delta) => {
    expect(moveItem(items, id, delta)).toBeNull();
  });

  it('cannot move the only item of a list', () => {
    expect(moveItem([{ id: 'a' }], 'a', -1)).toBeNull();
    expect(moveItem([{ id: 'a' }], 'a', 1)).toBeNull();
  });

  it('leaves the list it was given unchanged', () => {
    const before = items.map((i) => i.id);
    moveItem(items, 'b', -1);
    expect(items.map((i) => i.id)).toEqual(before);
  });

  describe('within groups (skills move inside their category)', () => {
    // x: a1 a2 a3, y: b1 b2, interleaved as a1 b1 a2 b2 a3
    const skills = [
      { id: 'a1', group: 'x' },
      { id: 'b1', group: 'y' },
      { id: 'a2', group: 'x' },
      { id: 'b2', group: 'y' },
      { id: 'a3', group: 'x' },
    ];
    const groupOf = (s: { group: string }) => s.group;

    it.each([
      ['a2', -1, ['a2', 'b1', 'a1', 'b2', 'a3']],
      ['a2', 1, ['a1', 'b1', 'a3', 'b2', 'a2']],
      ['b1', 1, ['a1', 'b2', 'a2', 'b1', 'a3']],
      ['b2', -1, ['a1', 'b2', 'a2', 'b1', 'a3']],
    ] as const)('swaps %s (%i) with the nearest item of its own group', (id, delta, expected) => {
      expect(moveItem(skills, id, delta, groupOf)).toEqual(expected);
    });

    it.each([
      ['a1', -1],
      ['a3', 1],
      ['b1', -1],
      ['b2', 1],
    ] as const)('cannot move %s (%i) past the first or last of its group', (id, delta) => {
      expect(moveItem(skills, id, delta, groupOf)).toBeNull();
    });

    it('would swap with the neighbour of another group without groupOf', () => {
      expect(moveItem(skills, 'a2', -1)).toEqual(['a1', 'a2', 'b1', 'b2', 'a3']);
    });
  });
});
