import { formatQuery, parseQuery, type LabelOp } from './parse';

/**
 * `query` with the selector narrowed to `label op value` ("filter for this value" on a log line).
 * An existing matcher on the same label is replaced, except for `tech`, which can hold several
 * values: there the matcher is added unless that value is already there. Throws a
 * `QueryParseError` if `query` is invalid.
 */
export function withLabelMatcher(
  query: string,
  label: string,
  value: string,
  op: LabelOp = '=',
): string {
  const parsed = parseQuery(query);
  const matcher = { label, op, value };
  const same =
    label === 'tech'
      ? (m: { label: string; value: string }) =>
          m.label === label && m.value.toLowerCase() === value.toLowerCase()
      : (m: { label: string }) => m.label === label;
  const index = parsed.matchers.findIndex(same);
  const matchers =
    index === -1
      ? [...parsed.matchers, matcher]
      : parsed.matchers.map((m, i) =>
          // A tech value already there keeps how it was written; only the operator changes.
          i === index ? (label === 'tech' ? { ...m, op } : matcher) : m,
        );
  return formatQuery({ ...parsed, matchers });
}
