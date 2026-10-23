import { MAX_SPAN_DEPTH } from '@my-resume/resume-metrics';

/**
 * Outline editing for project spans. A span moves with its sub-spans (the spans right below it that
 * are deeper), like in an outliner. Each function returns a new list, or the same list when the
 * change isn't possible.
 */
type Item = { depth: number };

/** The index after the block made of span `index` and its sub-spans. */
function blockEnd(list: Item[], index: number): number {
  let end = index + 1;
  while (end < list.length && list[end].depth > list[index].depth) end++;
  return end;
}

function shift<T extends Item>(list: T[], index: number, by: number): T[] {
  const end = blockEnd(list, index);
  return list.map((item, i) =>
    i >= index && i < end ? { ...item, depth: item.depth + by } : item,
  );
}

export function canIndent(list: Item[], index: number): boolean {
  if (index === 0) return false;
  const deepest = Math.max(...list.slice(index, blockEnd(list, index)).map((s) => s.depth));
  return list[index].depth <= list[index - 1].depth && deepest < MAX_SPAN_DEPTH;
}

export function indent<T extends Item>(list: T[], index: number): T[] {
  return canIndent(list, index) ? shift(list, index, 1) : list;
}

export function outdent<T extends Item>(list: T[], index: number): T[] {
  return list[index]?.depth > 0 ? shift(list, index, -1) : list;
}

/** Start index of the sibling block above span `index`, or -1. */
function previousSibling(list: Item[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    if (list[i].depth === list[index].depth) return i;
    if (list[i].depth < list[index].depth) return -1;
  }
  return -1;
}

export function moveUp<T extends Item>(list: T[], index: number): T[] {
  const previous = previousSibling(list, index);
  if (previous === -1) return list;
  const end = blockEnd(list, index);
  return [
    ...list.slice(0, previous),
    ...list.slice(index, end),
    ...list.slice(previous, index),
    ...list.slice(end),
  ];
}

export function moveDown<T extends Item>(list: T[], index: number): T[] {
  const next = blockEnd(list, index);
  if (next >= list.length || list[next].depth !== list[index].depth) return list;
  return moveUp(list, next);
}

export function removeSpan<T extends Item>(list: T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(blockEnd(list, index))];
}
