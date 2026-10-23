import { compileQuery, type LogRecord } from './match';
import { parseQuery } from './parse';

const acme: LogRecord = {
  labels: { type: 'experience', level: 'achievement', company: 'Acme', role: 'Tech Lead' },
  tech: ['Angular', 'NgRx'],
  line: 'Acme Cut API p95 latency by 40% with Kubernetes autoscaling.',
};
const school: LogRecord = {
  labels: { type: 'education', level: 'milestone', school: 'ESIL' },
  tech: [],
  line: 'ESIL Graduated: Master, Computer Science',
};
const records = [acme, school];

/** Which of the records the query keeps, by index. */
const kept = (query: string) =>
  records.flatMap((r, i) => (compileQuery(parseQuery(query))(r) ? [i] : []));

describe('compileQuery', () => {
  it('keeps everything for an empty query', () => {
    expect(kept('')).toEqual([0, 1]);
  });

  describe('label matchers', () => {
    it('compares values case-insensitively with = and !=', () => {
      expect(kept('{company="acme"}')).toEqual([0]);
      expect(kept('{company!="ACME"}')).toEqual([1]);
    });

    it('needs every matcher to hold', () => {
      expect(kept('{type="experience", level="milestone"}')).toEqual([]);
      expect(kept('{type="education", level="milestone"}')).toEqual([1]);
    });

    it('matches regular expressions against the whole value, case-insensitively', () => {
      expect(kept('{role=~"tech.*"}')).toEqual([0]);
      expect(kept('{role=~"tech"}')).toEqual([]);
      expect(kept('{level=~"achievement|milestone"}')).toEqual([0, 1]);
      expect(kept('{level!~"ACHIEVEMENT"}')).toEqual([1]);
    });

    it('treats a missing label as the empty string', () => {
      expect(kept('{company=""}')).toEqual([1]);
      expect(kept('{company!=""}')).toEqual([0]);
      expect(kept('{team="x"}')).toEqual([]);
      expect(kept('{team!="x"}')).toEqual([0, 1]);
    });

    it('ignores JavaScript object properties used as label names', () => {
      expect(kept('{constructor="x"}')).toEqual([]);
      expect(kept('{constructor=""}')).toEqual([0, 1]);
      expect(kept('{__proto__!="x"}')).toEqual([0, 1]);
      expect(kept('{toString=~".+"}')).toEqual([]);
      expect(kept('{hasOwnProperty!~".*"}')).toEqual([]);
    });

    it('matches tech when any technology matches, and != / !~ when none does', () => {
      expect(kept('{tech="ngrx"}')).toEqual([0]);
      expect(kept('{tech!="ngrx"}')).toEqual([1]);
      expect(kept('{tech=~"ang.*"}')).toEqual([0]);
      expect(kept('{tech!~"ang.*"}')).toEqual([1]);
      expect(kept('{tech=""}')).toEqual([1]);
    });
  });

  describe('line filters', () => {
    it('searches the line case-insensitively', () => {
      expect(kept('|= "KUBERNETES"')).toEqual([0]);
      expect(kept('!= "kubernetes"')).toEqual([1]);
      expect(kept('kubernetes')).toEqual([0]);
    });

    it('matches regular expressions anywhere in the line', () => {
      expect(kept('|~ "p9[59]"')).toEqual([0]);
      expect(kept('|~ `\\d+%`')).toEqual([0]);
      expect(kept('!~ "^acme"')).toEqual([1]);
    });

    it('runs in linear time, even for patterns that backtrack badly in other engines', () => {
      const long: LogRecord = {
        labels: { role: 'a'.repeat(120) },
        tech: [],
        line: 'a'.repeat(2000),
      };
      const start = performance.now();
      for (const pattern of ['a*a*a*a*b', '.*.*.*.*b', '(a+)+b', '(a|aa)*b']) {
        expect(compileQuery(parseQuery(`|~ "${pattern}"`))(long)).toBe(false);
        expect(compileQuery(parseQuery(`{role=~"${pattern}"}`))(long)).toBe(false);
      }
      // Backtracking engines take minutes here; RE2 takes milliseconds.
      expect(performance.now() - start).toBeLessThan(2000);
    });

    it('applies every filter, after the selector', () => {
      expect(kept('{type="experience"} |= "api" |= "latency"')).toEqual([0]);
      expect(kept('{type="experience"} |= "api" != "latency"')).toEqual([]);
      expect(kept('{type="education"} |= "api"')).toEqual([]);
    });
  });
});
