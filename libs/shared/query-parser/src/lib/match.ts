import type { LabelMatcher, LineFilter, LogQuery } from './parse';
import { regexTest } from './regex';

/** What a query looks at in a log line. */
export interface LogRecord {
  labels: Record<string, string>;
  /** The `tech` label, which can hold several values. */
  tech: string[];
  /** The text the line filters search. */
  line: string;
}

type Test = (record: LogRecord) => boolean;

/**
 * Turns a parsed query into a test for one record. Every comparison ignores case. A missing label
 * counts as ''. `tech` matches with `=` / `=~` when any of its values does, and with `!=` / `!~`
 * when none does. The query must come from `parseQuery`, which has already checked its regexes.
 */
export function compileQuery(query: LogQuery): Test {
  const tests = [...query.matchers.map(labelTest), ...query.filters.map(lineTest)];
  return (record) => tests.every((test) => test(record));
}

function labelTest({ label, op, value }: LabelMatcher): Test {
  const accepts =
    op === '=' || op === '!='
      ? (v: string) => v.toLowerCase() === value.toLowerCase()
      : regexTest(value, true);
  const negated = op === '!=' || op === '!~';
  return (record) => {
    const values =
      label === 'tech' ? (record.tech.length ? record.tech : ['']) : [labelOf(record, label)];
    return values.some(accepts) !== negated;
  };
}

function lineTest({ op, value }: LineFilter): Test {
  const needle = value.toLowerCase();
  const accepts =
    op === '|=' || op === '!='
      ? (line: string) => line.toLowerCase().includes(needle)
      : regexTest(value);
  const negated = op === '!=' || op === '!~';
  return (record) => accepts(record.line) !== negated;
}

/** The label's value, or '' when missing. Own properties only, so `constructor` isn't a label. */
function labelOf(record: LogRecord, label: string): string {
  return Object.prototype.hasOwnProperty.call(record.labels, label) ? record.labels[label] : '';
}
