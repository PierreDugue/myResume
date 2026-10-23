import { convertToParamMap } from '@angular/router';
import { parseExploreQuery, toExploreParams } from './explore-query';

describe('explore query (URL)', () => {
  const parse = (params: Record<string, string>) => parseExploreQuery(convertToParamMap(params));

  it('reads the query and the years', () => {
    expect(parse({ query: '{company="KX"}', from: '2020', to: '2024' })).toEqual({
      query: '{company="KX"}',
      from: 2020,
      to: 2024,
    });
  });

  it('ignores empty or invalid values', () => {
    expect(parse({})).toEqual({});
    expect(parse({ query: '', from: 'abc', to: '20' })).toEqual({});
  });

  it('keeps the query exactly as typed', () => {
    expect(parse({ query: '  angular ' })).toEqual({ query: '  angular ' });
  });

  it('writes query params, with null for what is not set so it leaves the URL', () => {
    expect(toExploreParams({ query: 'x', from: 2020 })).toEqual({
      query: 'x',
      from: 2020,
      to: null,
    });
    expect(toExploreParams({ query: '' })).toEqual({ query: null, from: null, to: null });
  });
});
