import { TEST_PALETTE } from '../overview/testing/dashboard-fixture';
import { nodeLink, serviceMapOption } from './service-map-option';
import { serviceMapFixture } from './testing/service-map-fixture';

describe('serviceMapOption', () => {
  const option = serviceMapOption(serviceMapFixture(), TEST_PALETTE);
  const [series] = option.series as {
    type: string;
    layout: string;
    data: { id: string; name: string; category: number; symbolSize: number; value: number }[];
    links: { source: string; target: string }[];
    categories: { name: string }[];
  }[];

  it('draws a force-directed graph of the nodes and edges', () => {
    expect(series).toMatchObject({ type: 'graph', layout: 'force' });
    expect(series.data.map((n) => [n.id, n.name, n.category])).toEqual([
      ['job:e-whoz', 'Whoz', 0],
      ['job:e-kx', 'KX', 0],
      ['project:p-site', 'Pierre O11y', 1],
      ['skill:sk-angular', 'Angular', 2],
      ['skill:sk-ngrx', 'NgRx', 2],
      ['skill:sk-claude', 'Claude', 2],
    ]);
    expect(series.links).toEqual(serviceMapFixture().edges);
    expect(series.categories.map((c) => c.name)).toEqual(['Jobs', 'Projects', 'Technologies']);
    expect(option.legend).toMatchObject({ data: ['Jobs', 'Projects', 'Technologies'] });
  });

  it('sizes nodes by years of experience, within bounds', () => {
    const size = (id: string) => series.data.find((n) => n.id === id)?.symbolSize ?? 0;
    expect(size('skill:sk-angular')).toBeGreaterThan(size('skill:sk-ngrx'));
    expect(size('skill:sk-ngrx')).toBeGreaterThan(size('skill:sk-claude'));
    expect(size('project:p-site')).toBeGreaterThanOrEqual(10);
    expect(size('skill:sk-angular')).toBeLessThanOrEqual(64);
  });

  it('colors each kind of node with a fixed palette slot and describes itself', () => {
    expect(option.color).toEqual([
      TEST_PALETTE.series[1],
      TEST_PALETTE.series[3],
      TEST_PALETTE.series[0],
    ]);
    expect(option.aria).toMatchObject({ enabled: true });
  });
});

describe('nodeLink', () => {
  const node = (id: string) => serviceMapFixture().nodes.find((n) => n.id === id);

  it('filters the dashboard by a technology', () => {
    expect(nodeLink(node('skill:sk-angular'))).toEqual({
      path: '/',
      queryParams: { skill: 'angular' },
    });
  });

  it("opens a project's trace", () => {
    expect(nodeLink(node('project:p-site'))).toEqual({
      path: '/traces/pierre-o11y',
      queryParams: {},
    });
  });

  it("searches a job's achievements in Explore", () => {
    expect(nodeLink(node('job:e-kx'))).toEqual({
      path: '/explore',
      queryParams: { query: '{company="KX"}' },
    });
    expect(
      nodeLink({
        id: 'job:x',
        kind: 'job',
        label: 'Say "Hi"',
        years: 1,
        slug: null,
        category: null,
      }).queryParams,
    ).toEqual({ query: '{company="Say \\"Hi\\""}' });
  });
});
