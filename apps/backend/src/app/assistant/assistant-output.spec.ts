import { AssistantOutputError, MAX_ANSWER_LENGTH, parseAssistantOutput } from './assistant-output';

const json = (value: unknown) => JSON.stringify(value);

describe('parseAssistantOutput', () => {
  it('reads the answer and the Explore query', () => {
    expect(
      parseAssistantOutput(json({ answer: 'Acme and Globex.', exploreQuery: '{company="Acme"}' })),
    ).toEqual({ answer: 'Acme and Globex.', exploreQuery: '{company="Acme"}' });
  });

  it('trims the answer and the query', () => {
    expect(
      parseAssistantOutput(json({ answer: '  Hi\n', exploreQuery: ' {type="project"} ' })),
    ).toEqual({
      answer: 'Hi',
      exploreQuery: '{type="project"}',
    });
  });

  it('keeps line breaks inside the answer', () => {
    expect(parseAssistantOutput(json({ answer: 'one\ntwo' })).answer).toBe('one\ntwo');
  });

  it('cuts the answer to 2000 characters', () => {
    expect(MAX_ANSWER_LENGTH).toBe(2000);
    const answer = parseAssistantOutput(json({ answer: 'a'.repeat(2500) })).answer;
    expect(answer).toHaveLength(2000);
  });

  it('keeps an answer of exactly 2000 characters whole', () => {
    expect(parseAssistantOutput(json({ answer: 'a'.repeat(2000) })).answer).toHaveLength(2000);
  });

  it.each<[string, unknown]>([
    ['missing', undefined],
    ['null', null],
    ['blank', '  \n '],
    ['a number', 42],
    ['an object', { text: 'x' }],
  ])('refuses an answer that is %s', (_name, answer) => {
    expect(() => parseAssistantOutput(json({ answer }))).toThrow(AssistantOutputError);
  });

  it.each([
    ['text that is not JSON', 'Sure! Acme.'],
    ['truncated JSON', '{"answer": "Acme'],
    ['an empty string', ''],
    ['null', 'null'],
    ['an array', '[{"answer":"x"}]'],
    ['a JSON string', '"Acme"'],
  ])('refuses %s', (_name, text) => {
    expect(() => parseAssistantOutput(text)).toThrow(AssistantOutputError);
  });

  it.each<[string, unknown]>([
    ['missing', undefined],
    ['null', null],
    ['blank', '   '],
    ['a number', 7],
    ['an array', ['{type="project"}']],
  ])('gives no Explore query when it is %s', (_name, exploreQuery) => {
    expect(parseAssistantOutput(json({ answer: 'ok', exploreQuery }))).toEqual({
      answer: 'ok',
      exploreQuery: null,
    });
  });
});
