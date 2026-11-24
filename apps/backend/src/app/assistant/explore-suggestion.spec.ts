import { assistantResumeFixture, FIXTURE_TODAY } from '../../testing/resume.fixture';
import { toExploreSuggestion } from './explore-suggestion';

describe('toExploreSuggestion', () => {
  const suggest = (query: string | null) =>
    toExploreSuggestion({ query, resume: assistantResumeFixture(), today: FIXTURE_TODAY });

  it.each([
    ['one company', '{company="Acme"}', 1],
    ['every experience line', '{type="experience"}', 2],
    ['a project', '{type="project"}', 1],
    ['an education line', '{type="education"}', 1],
    ['a text filter', '{type="experience"} |= "billing"', 1],
    ['a regex matcher', '{company=~"Acme|Globex"}', 2],
    ['a tech label', '{tech="Angular"}', 2],
  ])('returns the query and its line count for %s', (_name, query, matches) => {
    expect(suggest(query)).toEqual({ query, matches });
  });

  it('returns null without a query', () => {
    expect(suggest(null)).toBeNull();
  });

  it('returns null for a query that matches nothing', () => {
    expect(suggest('{company="Nowhere Inc"}')).toBeNull();
  });

  it.each([
    ['a syntax error', '{company='],
    ['an unterminated string', '{company="Acme}'],
    ['a regex over 100 characters', `{company=~"${'a'.repeat(101)}"}`],
    ['a query over 500 characters', `{type="project"} |= "${'a'.repeat(500)}"`],
  ])('returns null for %s', (_name, query) => {
    expect(suggest(query)).toBeNull();
  });
});
