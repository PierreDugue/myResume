import { spanOutlineErrors, spanParents } from './spans';

type Span = { depth: number; name: string; startDate: string; endDate: string | null };
const span = (
  depth: number,
  name: string,
  startDate = '2026-01-01',
  endDate: string | null = '2026-12-31',
): Span => ({
  depth,
  name,
  startDate,
  endDate,
});
const project = { startDate: null, endDate: null };

describe('spanParents', () => {
  it('gives each span the nearest span above it one level up', () => {
    expect(spanParents([0, 1, 2, 1, 0, 1])).toEqual([null, 0, 1, 0, null, 4]);
  });

  it('handles an empty outline', () => {
    expect(spanParents([])).toEqual([]);
  });
});

describe('spanOutlineErrors', () => {
  it('accepts a valid outline', () => {
    expect(
      spanOutlineErrors(
        [
          span(0, 'Backend'),
          span(1, 'API', '2026-02-01', '2026-03-01'),
          span(2, 'Auth', '2026-02-01', '2026-02-01'),
          span(3, 'JWT', '2026-02-01', '2026-02-01'),
          span(0, 'Frontend', '2026-06-01', null),
          span(1, 'Live', '2026-07-01', null),
        ],
        project,
      ),
    ).toEqual([]);
  });

  it('checks the nesting', () => {
    expect(spanOutlineErrors([span(1, 'API')], project)).toEqual([
      'Span 1 "API" must be at the top level',
    ]);
    expect(spanOutlineErrors([span(0, 'A'), span(2, 'B')], project)).toEqual([
      'Span 2 "B" can only be one level deeper than the span above it',
    ]);
    expect(
      spanOutlineErrors(
        [span(0, 'A'), span(1, 'B'), span(2, 'C'), span(3, 'D'), span(4, 'E')],
        project,
      ),
    ).toEqual(['Span 5 "E" is nested too deep: at most 4 levels']);
    expect(spanOutlineErrors([span(-1, 'A')], project)).toEqual([
      'Span 1 "A" must be at the top level',
    ]);
  });

  it('checks the dates of each span', () => {
    expect(spanOutlineErrors([span(0, 'A', '2026-05-01', '2026-04-01')], project)).toEqual([
      'Span 1 "A" can\'t end before it starts',
    ]);
  });

  it('keeps a span inside its parent', () => {
    expect(
      spanOutlineErrors(
        [span(0, 'A', '2026-02-01', '2026-03-01'), span(1, 'B', '2026-01-15', '2026-02-15')],
        project,
      ),
    ).toEqual(['Span 2 "B" can\'t start before "A"']);
    expect(
      spanOutlineErrors(
        [span(0, 'A', '2026-02-01', '2026-03-01'), span(1, 'B', '2026-02-15', '2026-03-02')],
        project,
      ),
    ).toEqual(['Span 2 "B" can\'t end after "A"']);
    expect(
      spanOutlineErrors(
        [span(0, 'A', '2026-02-01', '2026-03-01'), span(1, 'B', '2026-02-15', null)],
        project,
      ),
    ).toEqual(['Span 2 "B" can\'t end after "A"']);
  });

  it('keeps every span inside the project dates when they are set', () => {
    const dated = { startDate: '2026-02-01', endDate: '2026-11-30' };
    expect(spanOutlineErrors([span(0, 'A', '2026-01-31', '2026-03-01')], dated)).toEqual([
      'Span 1 "A" can\'t start before the project',
    ]);
    expect(spanOutlineErrors([span(0, 'A', '2026-02-01', null)], dated)).toEqual([
      'Span 1 "A" can\'t end after the project',
    ]);
    expect(spanOutlineErrors([span(0, 'A', '2026-02-01', '2026-11-30')], dated)).toEqual([]);
    // An ongoing project has no end.
    expect(
      spanOutlineErrors([span(0, 'A', '2026-02-01', null)], {
        startDate: '2026-02-01',
        endDate: null,
      }),
    ).toEqual([]);
  });

  it('reports every problem, in order', () => {
    expect(spanOutlineErrors([span(1, 'A', '2026-05-01', '2026-04-01')], project)).toEqual([
      'Span 1 "A" must be at the top level',
      'Span 1 "A" can\'t end before it starts',
    ]);
  });
});
