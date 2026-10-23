import { formatQuery, parseQuery, QueryParseError } from './parse';

/** The error of parsing `input`, or fails the test. */
function errorOf(input: string): QueryParseError {
  try {
    parseQuery(input);
  } catch (e) {
    if (e instanceof QueryParseError) return e;
    throw e;
  }
  throw new Error(`Expected "${input}" to be rejected`);
}

describe('parseQuery', () => {
  it('reads an empty query as "match everything"', () => {
    expect(parseQuery('')).toEqual({ matchers: [], filters: [] });
    expect(parseQuery('   ')).toEqual({ matchers: [], filters: [] });
    expect(parseQuery('{}')).toEqual({ matchers: [], filters: [] });
  });

  it('reads a label selector with every operator', () => {
    expect(parseQuery('{company="Acme", level!="info", role=~"lead.*", tech!~"java|php"}')).toEqual(
      {
        matchers: [
          { label: 'company', op: '=', value: 'Acme' },
          { label: 'level', op: '!=', value: 'info' },
          { label: 'role', op: '=~', value: 'lead.*' },
          { label: 'tech', op: '!~', value: 'java|php' },
        ],
        filters: [],
      },
    );
  });

  it('reads line filters after the selector, in order', () => {
    expect(
      parseQuery('{type="experience"} |= "kubernetes" != "legacy" |~ "p9[59]" !~ "test"'),
    ).toEqual({
      matchers: [{ label: 'type', op: '=', value: 'experience' }],
      filters: [
        { op: '|=', value: 'kubernetes' },
        { op: '!=', value: 'legacy' },
        { op: '|~', value: 'p9[59]' },
        { op: '!~', value: 'test' },
      ],
    });
  });

  it('accepts line filters without a selector', () => {
    expect(parseQuery('|= "angular"')).toEqual({
      matchers: [],
      filters: [{ op: '|=', value: 'angular' }],
    });
    expect(parseQuery('!= "angular"').filters).toEqual([{ op: '!=', value: 'angular' }]);
  });

  it('reads plain text as a "contains" filter', () => {
    expect(parseQuery('  page load time ')).toEqual({
      matchers: [],
      filters: [{ op: '|=', value: 'page load time' }],
    });
  });

  it('ignores whitespace between tokens and allows a trailing comma', () => {
    expect(parseQuery(' {  company = "Acme" ,level="info", }|="x"')).toEqual({
      matchers: [
        { label: 'company', op: '=', value: 'Acme' },
        { label: 'level', op: '=', value: 'info' },
      ],
      filters: [{ op: '|=', value: 'x' }],
    });
  });

  it('reads escapes in double-quoted strings and keeps other backslashes for regexes', () => {
    expect(parseQuery('|= "say \\"hi\\" \\\\ now"').filters[0].value).toBe('say "hi" \\ now');
    expect(parseQuery('|~ "\\d+%"').filters[0].value).toBe('\\d+%');
  });

  it('reads backtick strings raw', () => {
    expect(parseQuery('{role=~`.*\\(lead\\)`}').matchers[0].value).toBe('.*\\(lead\\)');
  });

  it('accepts label names with digits and underscores', () => {
    expect(parseQuery('{team_2="x"}').matchers[0].label).toBe('team_2');
  });

  describe('errors give a message and a 1-based column', () => {
    it.each([
      ['{company "Acme"}', 10, 'Expected "=", "!=", "=~" or "!~" after "company"'],
      ['{company=Acme}', 10, 'Expected a quoted value'],
      ['{company="Acme"', 16, 'Expected "," or "}"'],
      ['{="Acme"}', 2, 'Expected a label name'],
      ['{9lives="x"}', 2, 'Expected a label name'],
      ['{company="Acme', 10, 'Unterminated string'],
      ['|= `abc', 4, 'Unterminated string'],
      ['{a="x"} "y"', 9, 'Expected a line filter ("|=", "!=", "|~" or "!~")'],
      ['{a="x"} |= ', 12, 'Expected a quoted value'],
      ['{a="x"} | "y"', 9, 'Expected a line filter ("|=", "!=", "|~" or "!~")'],
      ['{a="x"} {b="y"}', 9, 'Expected a line filter ("|=", "!=", "|~" or "!~")'],
    ])('%s', (input, column, message) => {
      const error = errorOf(input);
      expect(error.column).toBe(column);
      expect(error.message).toBe(`${message} (column ${column})`);
    });
  });

  it('rejects an invalid regular expression at its value', () => {
    const error = errorOf('{role=~"lead("}');
    expect(error.column).toBe(8);
    expect(error.message).toMatch(/^Invalid regular expression/);
  });

  it('rejects a query longer than 500 characters', () => {
    const error = errorOf(`|= "${'a'.repeat(500)}"`);
    expect(error.message).toBe('The query is too long: at most 500 characters (column 501)');
  });

  describe('regular expressions (RE2 syntax, matched in linear time)', () => {
    it.each([
      '(a+)+',
      '(a|b)*',
      'a*a*a*a*b',
      '.*.*.*.*b',
      '(?:x+)+',
      '[(+)]+',
      'a{2,3}',
      '(\\d+)%',
    ])('accepts %s, since no pattern can be slow', (pattern) => {
      expect(() => parseQuery(`|~ \`${pattern}\``)).not.toThrow();
    });

    it.each([
      ['(a)\\1', 'a back-reference'],
      ['(?=a)', 'a lookahead'],
      ['(?<!a)b', 'a lookbehind'],
    ])('refuses %s (%s) as invalid', (pattern) => {
      const error = errorOf(`|~ \`${pattern}\``);
      expect(error.column).toBe(4);
      expect(error.message).toMatch(/^Invalid regular expression/);
    });

    it('refuses a regular expression over 100 characters', () => {
      const error = errorOf(`|~ \`${'x'.repeat(101)}\``);
      expect(error.message).toBe('Regular expression too long: at most 100 characters (column 4)');
    });
  });
});

describe('formatQuery', () => {
  it('prints a query in the canonical form', () => {
    expect(
      formatQuery({
        matchers: [
          { label: 'company', op: '=', value: 'Acme' },
          { label: 'level', op: '!=', value: 'info' },
        ],
        filters: [{ op: '|=', value: 'say "hi"' }],
      }),
    ).toBe('{company="Acme", level!="info"} |= "say \\"hi\\""');
  });

  it('prints only the parts that are set', () => {
    expect(formatQuery({ matchers: [], filters: [] })).toBe('');
    expect(formatQuery({ matchers: [], filters: [{ op: '!~', value: 'x' }] })).toBe('!~ "x"');
  });

  it('round-trips through parseQuery', () => {
    const query = '{role=~"lead.*\\\\d", tech="C#"} |= "a\\\\b" !~ "x"';
    expect(formatQuery(parseQuery(query))).toBe(query);
    expect(parseQuery(formatQuery(parseQuery(query)))).toEqual(parseQuery(query));
  });
});
