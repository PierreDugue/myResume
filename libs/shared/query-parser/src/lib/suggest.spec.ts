import { applySuggestion, suggest, type LabelValues } from './suggest';

const labels: LabelValues[] = [
  { name: 'type', values: ['education', 'experience', 'project'] },
  { name: 'level', values: ['achievement', 'info', 'learning', 'milestone'] },
  { name: 'company', values: ['Acme', 'Globex', 'Say "Hi" Inc'] },
  { name: 'tech', values: ['Angular', 'AngularJS', 'NgRx', 'React'] },
];

/** Suggests at the `|` marker of `text`. */
const at = (text: string) => {
  const cursor = text.indexOf('|');
  const input = text.slice(0, cursor) + text.slice(cursor + 1);
  return { input, cursor, result: suggest(input, cursor, labels) };
};

/** Applies item `index` of the suggestions at the `|` marker of `text`. */
const pick = (text: string, index = 0) => {
  const { input, result } = at(text);
  if (!result) throw new Error(`No suggestions for "${text}"`);
  return applySuggestion(input, result, result.items[index]);
};
const names = (text: string) => at(text).result?.items.map((i) => i.text);

describe('suggest', () => {
  describe('label names', () => {
    it('lists every label right after "{" or ","', () => {
      expect(names('{|')).toEqual(['type', 'level', 'company', 'tech']);
      expect(names('{type="project", |}')).toEqual(['type', 'level', 'company', 'tech']);
    });

    it('filters by the typed prefix, case-insensitively', () => {
      expect(names('{T|')).toEqual(['type', 'tech']);
      expect(names('{te|')).toEqual(['tech']);
      expect(names('{zz|')).toEqual([]);
    });

    it('replaces the whole label name and opens the value', () => {
      const { cursor, result } = at('{co|');
      expect(result).toMatchObject({ from: 1, to: 3, kind: 'label' });
      expect(pick('{co|')).toEqual({
        text: '{company="',
        cursor: 10,
      });
      expect(cursor).toBe(3);
    });

    it('only replaces the name when an operator follows', () => {
      expect(at('{co|mp="Acme"}').result).toMatchObject({ from: 1, to: 5 });
      expect(pick('{co|mp="Acme"}')).toEqual({
        text: '{company="Acme"}',
        cursor: 8,
      });
    });
  });

  describe('label values', () => {
    it('lists the values of the label inside its quotes', () => {
      expect(names('{level="|')).toEqual(['achievement', 'info', 'learning', 'milestone']);
      expect(names('{type="experience", level=~"|"}')).toEqual([
        'achievement',
        'info',
        'learning',
        'milestone',
      ]);
    });

    it('filters by what is typed: prefix matches first, then other matches', () => {
      expect(names('{tech="ang|')).toEqual(['Angular', 'AngularJS']);
      expect(names('{tech="r|')).toEqual(['React', 'Angular', 'AngularJS', 'NgRx']);
    });

    it('closes the string when it is not closed yet', () => {
      expect(at('{tech="ng|').result).toMatchObject({ from: 7, to: 9, kind: 'value' });
      expect(pick('{tech="ng|')).toEqual({
        text: '{tech="NgRx"',
        cursor: 12,
      });
    });

    it('replaces the whole value inside existing quotes', () => {
      // The closing quote is replaced too, so the cursor lands after it as when the string is open.
      expect(at('{company="|Acme"} |= "x"').result).toMatchObject({ from: 10, to: 15 });
      expect(pick('{company="|Acme"} |= "x"', 1)).toEqual({
        text: '{company="Globex"} |= "x"',
        cursor: 17,
      });
    });

    it('escapes quotes in a value', () => {
      expect(pick('{company="say|').text).toBe('{company="Say \\"Hi\\" Inc"');
    });

    it('suggests nothing for an unknown label', () => {
      expect(at('{team="|').result).toBeNull();
    });
  });

  it('suggests nothing outside the selector', () => {
    expect(at('|').result).toBeNull();
    expect(at('{type="project"} |').result).toBeNull();
    expect(at('{type="project"} |= "|"').result).toBeNull();
    expect(at('angular|').result).toBeNull();
    expect(at('{type|="x"}').result).toMatchObject({ kind: 'label' });
    expect(at('{type=|').result).toBeNull();
  });

  it('is not fooled by braces and commas inside strings', () => {
    expect(names('{company="a,b}", |')).toEqual(['type', 'level', 'company', 'tech']);
    expect(at('|= "{" |').result).toBeNull();
  });
});
