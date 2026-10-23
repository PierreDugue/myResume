import { checkRegex } from './regex';

/** `=` equals, `!=` differs, `=~` / `!~` (doesn't) match a regular expression on the whole value. */
export type LabelOp = '=' | '!=' | '=~' | '!~';
/** `|=` contains, `!=` doesn't contain, `|~` / `!~` (doesn't) match a regular expression. */
export type LineOp = '|=' | '!=' | '|~' | '!~';

export interface LabelMatcher {
  label: string;
  op: LabelOp;
  value: string;
}

export interface LineFilter {
  op: LineOp;
  value: string;
}

/** A parsed query: every matcher and every filter must hold for a line to match. */
export interface LogQuery {
  matchers: LabelMatcher[];
  filters: LineFilter[];
}

export const MAX_QUERY_LENGTH = 500;

/** A query that can't be read. `column` is 1-based and is also part of the message. */
export class QueryParseError extends Error {
  constructor(
    readonly reason: string,
    readonly column: number,
  ) {
    super(`${reason} (column ${column})`);
    this.name = 'QueryParseError';
  }
}

const LABEL_OPS: LabelOp[] = ['=~', '!~', '!=', '='];
const LINE_OPS: LineOp[] = ['|=', '|~', '!=', '!~'];
const LABEL_START = /[a-zA-Z_]/;
const LABEL_CHAR = /[a-zA-Z0-9_]/;

/**
 * Reads a LogQL-style query (see docs/api-contract.md, Explore):
 * `{label op "value", ...} |= "text" != "text" |~ "regex" !~ "regex"`, every part optional.
 * A query that doesn't start with `{`, `|` or `!` is plain text, read as `|= "<text>"`.
 * Throws a `QueryParseError` that points at the problem.
 */
export function parseQuery(input: string): LogQuery {
  if (input.length > MAX_QUERY_LENGTH) {
    throw new QueryParseError(
      `The query is too long: at most ${MAX_QUERY_LENGTH} characters`,
      MAX_QUERY_LENGTH + 1,
    );
  }
  const text = input.trim();
  if (text === '') return { matchers: [], filters: [] };
  if (!/^[{|!]/.test(text)) return { matchers: [], filters: [{ op: '|=', value: text }] };
  return new Parser(input).parse();
}

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): LogQuery {
    const matchers: LabelMatcher[] = [];
    const filters: LineFilter[] = [];
    this.skipSpaces();
    if (this.peek() === '{') {
      this.pos++;
      this.readSelector(matchers);
    }
    for (this.skipSpaces(); !this.atEnd(); this.skipSpaces()) {
      const op = LINE_OPS.find((o) => this.input.startsWith(o, this.pos));
      if (!op) this.fail('Expected a line filter ("|=", "!=", "|~" or "!~")');
      this.pos += op.length;
      this.skipSpaces();
      const value = this.readString();
      if (op === '|~' || op === '!~') this.checkRegex(value);
      filters.push({ op, value: value.text });
    }
    return { matchers, filters };
  }

  private readSelector(matchers: LabelMatcher[]): void {
    for (;;) {
      this.skipSpaces();
      if (this.peek() === '}') {
        this.pos++;
        return;
      }
      const label = this.readLabel();
      this.skipSpaces();
      const op = LABEL_OPS.find((o) => this.input.startsWith(o, this.pos));
      if (!op) this.fail(`Expected "=", "!=", "=~" or "!~" after "${label}"`);
      this.pos += op.length;
      this.skipSpaces();
      const value = this.readString();
      if (op === '=~' || op === '!~') this.checkRegex(value);
      matchers.push({ label, op, value: value.text });

      this.skipSpaces();
      const next = this.peek();
      if (next === ',') this.pos++;
      else if (next === '}') {
        this.pos++;
        return;
      } else this.fail('Expected "," or "}"');
    }
  }

  private readLabel(): string {
    const start = this.pos;
    if (!LABEL_START.test(this.peek())) this.fail('Expected a label name');
    while (LABEL_CHAR.test(this.peek())) this.pos++;
    return this.input.slice(start, this.pos);
  }

  /** A double-quoted string (`\"` and `\\` are escapes) or a raw backtick string. */
  private readString(): { text: string; start: number } {
    const start = this.pos;
    const quote = this.peek();
    if (quote !== '"' && quote !== '`') this.fail('Expected a quoted value');
    this.pos++;
    let text = '';
    while (!this.atEnd()) {
      const char = this.input[this.pos++];
      if (char === quote) return { text, start };
      if (char === '\\' && quote === '"') {
        const next = this.input[this.pos];
        if (next === '"' || next === '\\') {
          text += next;
          this.pos++;
          continue;
        }
      }
      text += char;
    }
    throw new QueryParseError('Unterminated string', start + 1);
  }

  private checkRegex(value: { text: string; start: number }): void {
    const problem = checkRegex(value.text);
    if (problem) throw new QueryParseError(problem, value.start + 1);
  }

  private skipSpaces(): void {
    while (/\s/.test(this.peek())) this.pos++;
  }

  private peek(): string {
    return this.input[this.pos] ?? '';
  }

  private atEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private fail(reason: string): never {
    throw new QueryParseError(reason, this.pos + 1);
  }
}

/** Prints a query in its canonical form: `{a="x", b!="y"} |= "z"`. */
export function formatQuery(query: LogQuery): string {
  const parts: string[] = [];
  if (query.matchers.length > 0) {
    const matchers = query.matchers.map((m) => `${m.label}${m.op}${quote(m.value)}`);
    parts.push(`{${matchers.join(', ')}}`);
  }
  for (const f of query.filters) parts.push(`${f.op} ${quote(f.value)}`);
  return parts.join(' ');
}

/** A double-quoted string that `parseQuery` reads back as `value`. */
export function quote(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}
