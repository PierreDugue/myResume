/** Deepest span level under the root (0 = a direct child of the project): 4 levels. */
export const MAX_SPAN_DEPTH = 3;

/** What the outline rules need to know about a span. */
export interface SpanOutlineItem {
  depth: number;
  name: string;
  startDate: string;
  endDate: string | null;
}

/** Index of each span's parent: the nearest span above it one level up (null at the top). */
export function spanParents(depths: number[]): (number | null)[] {
  const lastAtDepth: number[] = [];
  return depths.map((depth, index) => {
    lastAtDepth[depth] = index;
    lastAtDepth.length = depth + 1;
    return depth > 0 ? (lastAtDepth[depth - 1] ?? null) : null;
  });
}

/**
 * Every rule an outline of spans breaks (see docs/api-contract.md, projects), as messages naming the
 * span, in order. Empty when the outline is valid. Dates are `YYYY-MM-DD`, compared as strings;
 * a null end means ongoing.
 */
export function spanOutlineErrors(
  spans: SpanOutlineItem[],
  project: { startDate: string | null; endDate: string | null },
): string[] {
  const errors: string[] = [];
  const parents = spanParents(spans.map((s) => Math.max(0, s.depth)));
  // An ongoing end sorts after any date.
  const end = (date: string | null) => date ?? '9999-12-31';

  spans.forEach((span, index) => {
    const label = `Span ${index + 1} "${span.name}"`;
    const above = index > 0 ? spans[index - 1].depth : -1;
    if (span.depth < 0 || (index === 0 && span.depth !== 0)) {
      errors.push(`${label} must be at the top level`);
    } else if (span.depth > MAX_SPAN_DEPTH) {
      errors.push(`${label} is nested too deep: at most ${MAX_SPAN_DEPTH + 1} levels`);
    } else if (span.depth > above + 1) {
      errors.push(`${label} can only be one level deeper than the span above it`);
    }

    if (span.endDate !== null && span.endDate < span.startDate) {
      errors.push(`${label} can't end before it starts`);
    }

    const parentIndex = parents[index];
    const parent = parentIndex === null ? null : spans[parentIndex];
    if (parent && span.depth > 0) {
      if (span.startDate < parent.startDate)
        errors.push(`${label} can't start before "${parent.name}"`);
      if (end(span.endDate) > end(parent.endDate))
        errors.push(`${label} can't end after "${parent.name}"`);
    }

    if (project.startDate && span.startDate < project.startDate) {
      errors.push(`${label} can't start before the project`);
    }
    if (project.endDate && end(span.endDate) > project.endDate) {
      errors.push(`${label} can't end after the project`);
    }
  });
  return errors;
}
