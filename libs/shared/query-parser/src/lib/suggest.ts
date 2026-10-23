import { quote } from './parse';

/** A label the log lines use, with its distinct values (`LogLabel` in the API). */
export interface LabelValues {
  name: string;
  values: string[];
}

export interface Suggestion {
  /** What the list shows. */
  text: string;
  /** What replaces `input.slice(from, to)`. */
  insert: string;
}

export interface Suggestions {
  kind: 'label' | 'value';
  /** The part of the input a suggestion replaces (0-based, end excluded). */
  from: number;
  to: number;
  items: Suggestion[];
}

/**
 * Autocomplete at `cursor` (0-based): label names after `{` or `,`, and the values of a label
 * inside its quotes. Returns null anywhere else (line filters, plain text, operators).
 */
export function suggest(input: string, cursor: number, labels: LabelValues[]): Suggestions | null {
  const context = contextAt(input, cursor);
  if (!context) return null;

  if (context.kind === 'label') {
    let to = cursor;
    while (/[a-zA-Z0-9_]/.test(input[to] ?? '')) to++;
    const typed = input.slice(context.start, cursor).toLowerCase();
    const operatorFollows = /^\s*[=!]/.test(input.slice(to));
    return {
      kind: 'label',
      from: context.start,
      to,
      items: labels
        .filter((l) => l.name.toLowerCase().startsWith(typed))
        .map((l) => ({ text: l.name, insert: operatorFollows ? l.name : `${l.name}="` })),
    };
  }

  const values = labels.find((l) => l.name === context.label)?.values;
  if (!values) return null;
  const end = endOfString(input, context.start, context.quote);
  const closed = end < input.length;
  const typed = input.slice(context.start, cursor).toLowerCase();
  const starts = values.filter((v) => v.toLowerCase().startsWith(typed));
  const contains = values.filter(
    (v) => !v.toLowerCase().startsWith(typed) && v.toLowerCase().includes(typed),
  );
  return {
    kind: 'value',
    from: context.start,
    // Replace the closing quote too, so the cursor always lands after it.
    to: closed ? end + 1 : end,
    items: [...starts, ...contains].map((v) => ({
      text: v,
      insert: (context.quote === '"' ? quote(v) : `${v}\``).slice(context.quote === '"' ? 1 : 0),
    })),
  };
}

/** The input after choosing `item`, and where the cursor goes. */
export function applySuggestion(
  input: string,
  suggestions: Suggestions,
  item: Suggestion,
): { text: string; cursor: number } {
  const text = input.slice(0, suggestions.from) + item.insert + input.slice(suggestions.to);
  return { text, cursor: suggestions.from + item.insert.length };
}

type Context =
  | { kind: 'label'; start: number }
  | { kind: 'value'; label: string; start: number; quote: '"' | '`' };

/** Scans the input up to the cursor: where is it inside the selector, if at all? */
function contextAt(input: string, cursor: number): Context | null {
  let inSelector = false;
  let expectLabel = false;
  let labelStart = -1;
  let lastLabel = '';
  for (let i = 0; i < cursor; i++) {
    const char = input[i];
    if (char === '"' || char === '`') {
      const end = endOfString(input, i + 1, char);
      if (end >= cursor) {
        return inSelector && !expectLabel
          ? { kind: 'value', label: lastLabel, start: i + 1, quote: char }
          : null;
      }
      i = end;
      continue;
    }
    if (!inSelector) {
      if (char === '{' && input.slice(0, i).trim() === '') {
        inSelector = true;
        expectLabel = true;
        labelStart = i + 1;
      }
      continue;
    }
    if (char === '}') return null;
    if (char === ',') {
      expectLabel = true;
      labelStart = i + 1;
    } else if (expectLabel && /\s/.test(char) && labelStart === i) {
      labelStart = i + 1;
    } else if (expectLabel && !/[a-zA-Z0-9_]/.test(char)) {
      lastLabel = input.slice(labelStart, i).trim();
      expectLabel = false;
    }
  }
  return inSelector && expectLabel ? { kind: 'label', start: labelStart } : null;
}

/** Index of the quote closing a string whose text starts at `start`, or `input.length`. */
function endOfString(input: string, start: number, quoteChar: string): number {
  for (let i = start; i < input.length; i++) {
    if (input[i] === '\\' && quoteChar === '"') i++;
    else if (input[i] === quoteChar) return i;
  }
  return input.length;
}
