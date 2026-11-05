import { withLabelMatcher } from './edit';

describe('withLabelMatcher', () => {
  it('adds the matcher to the selector and keeps the line filters', () => {
    expect(withLabelMatcher('{type="experience"} |= "api"', 'company', 'Acme')).toBe(
      '{type="experience", company="Acme"} |= "api"',
    );
  });

  it('replaces an existing matcher on the same label', () => {
    expect(withLabelMatcher('{company!="Acme", level="info"}', 'company', 'Globex')).toBe(
      '{company="Globex", level="info"}',
    );
  });

  it('keeps several tech matchers, since a line can have several technologies', () => {
    expect(withLabelMatcher('{tech="Angular"}', 'tech', 'NgRx')).toBe(
      '{tech="Angular", tech="NgRx"}',
    );
    expect(withLabelMatcher('{tech="Angular"}', 'tech', 'angular')).toBe('{tech="Angular"}');
    expect(withLabelMatcher('{team="Angular"}', 'tech', 'angular')).toBe(
      '{team="Angular", tech="angular"}',
    );
  });

  it('supports != to exclude a value', () => {
    expect(withLabelMatcher('', 'level', 'info', '!=')).toBe('{level!="info"}');
  });

  it('keeps plain text as a line filter', () => {
    expect(withLabelMatcher('latency', 'company', 'Acme')).toBe('{company="Acme"} |= "latency"');
  });
});
