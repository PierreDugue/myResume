/** The new order after moving `id` one step (delta -1 = up), or null when it can't move.
 *  With `groupOf`, it swaps with the nearest item of the same group (skills move within their category). */
export function moveItem<T extends { id: string }>(
  items: readonly T[],
  id: string,
  delta: -1 | 1,
  groupOf?: (item: T) => string,
): string[] | null {
  const from = items.findIndex((item) => item.id === id);
  if (from === -1) return null;
  const group = groupOf?.(items[from]);
  let to = from + delta;
  while (to >= 0 && to < items.length && groupOf && groupOf(items[to]) !== group) to += delta;
  if (to < 0 || to >= items.length) return null;
  const ids = items.map((item) => item.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}
