import { convertToParamMap } from '@angular/router';
import { parseDashboardQuery, toQueryParams } from './dashboard-query';

describe('dashboard query in the URL', () => {
  it('reads the range and filters from the URL', () => {
    expect(
      parseDashboardQuery(
        convertToParamMap({ from: '2017', to: '2020', category: 'AI', skill: 'angular' }),
      ),
    ).toEqual({
      from: 2017,
      to: 2020,
      category: 'AI',
      skill: 'angular',
    });
  });

  it('ignores missing or malformed values', () => {
    expect(parseDashboardQuery(convertToParamMap({ from: 'abc', to: '20.5', skill: '' }))).toEqual(
      {},
    );
  });

  it('writes every key, null for the unset ones (so they leave the URL)', () => {
    expect(toQueryParams({ from: 2017, skill: 'angular' })).toEqual({
      from: 2017,
      to: null,
      category: null,
      skill: 'angular',
    });
  });
});
