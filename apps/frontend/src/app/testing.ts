/** Test helper: finds an element or fails with a readable message (instead of a `!` assertion). */
export function $<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Element not found: ${selector}`);
  return found;
}
