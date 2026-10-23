import { canIndent, indent, moveDown, moveUp, outdent, removeSpan } from './span-outline';

/** An outline as "name:depth" strings, for readable tests. */
const outline = (...items: string[]) =>
  items.map((item) => {
    const [name, depth] = item.split(':');
    return { name, depth: Number(depth) };
  });
const show = (list: { name: string; depth: number }[]) => list.map((s) => `${s.name}:${s.depth}`);

describe('span outline', () => {
  // A
  //   B
  //     C
  //   D
  // E
  const list = outline('A:0', 'B:1', 'C:2', 'D:1', 'E:0');

  describe('indent / outdent', () => {
    it('indents a span with its sub-spans', () => {
      expect(show(indent(list, 3))).toEqual(['A:0', 'B:1', 'C:2', 'D:2', 'E:0']);
      expect(show(indent(list, 4))).toEqual(['A:0', 'B:1', 'C:2', 'D:1', 'E:1']);
      expect(show(indent(outline('A:0', 'B:0', 'C:1'), 1))).toEqual(['A:0', 'B:1', 'C:2']);
    });

    it('only indents one level deeper than the span above, and not past depth 3', () => {
      expect(canIndent(list, 0)).toBe(false); // the first span stays at the top
      expect(canIndent(list, 1)).toBe(false); // B is already one deeper than A
      expect(canIndent(list, 3)).toBe(true);
      expect(canIndent(outline('A:0', 'B:1', 'C:2', 'D:3', 'E:3'), 4)).toBe(false);
      // Its sub-spans can't go past depth 3 either.
      expect(canIndent(outline('A:0', 'B:0', 'C:1', 'D:2', 'E:3'), 1)).toBe(false);
      expect(indent(list, 1)).toBe(list);
    });

    it('outdents a span with its sub-spans', () => {
      expect(show(outdent(list, 1))).toEqual(['A:0', 'B:0', 'C:1', 'D:1', 'E:0']);
      expect(outdent(list, 0)).toBe(list);
    });
  });

  describe('move up / down', () => {
    it('swaps a span and its sub-spans with the sibling above or below', () => {
      expect(show(moveDown(list, 1))).toEqual(['A:0', 'D:1', 'B:1', 'C:2', 'E:0']);
      expect(show(moveUp(list, 3))).toEqual(['A:0', 'D:1', 'B:1', 'C:2', 'E:0']);
      expect(show(moveUp(list, 4))).toEqual(['E:0', 'A:0', 'B:1', 'C:2', 'D:1']);
    });

    it('does nothing without a sibling on that side', () => {
      expect(moveUp(list, 0)).toBe(list);
      expect(moveUp(list, 1)).toBe(list); // B is A's first child
      expect(moveDown(list, 3)).toBe(list); // D is A's last child
      expect(moveDown(list, 4)).toBe(list);
    });
  });

  it('removes a span with its sub-spans', () => {
    expect(show(removeSpan(list, 1))).toEqual(['A:0', 'D:1', 'E:0']);
    expect(show(removeSpan(list, 4))).toEqual(['A:0', 'B:1', 'C:2', 'D:1']);
  });
});
