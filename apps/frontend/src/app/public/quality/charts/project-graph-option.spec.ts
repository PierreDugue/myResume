import { TEST_PALETTE } from '../../overview/testing/dashboard-fixture';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';
import { qualityFixture } from '../testing/quality-fixture';
import { projectGraphOption } from './project-graph-option';

describe('projectGraphOption', () => {
  const graph = qualityFixture().projectGraph;
  interface Series {
    type: string;
    edgeSymbol: string[];
    data: { id: string; name: string; value: string; category: number; symbolSize: number }[];
    links: { source: string; target: string }[];
    categories: { name: string }[];
  }
  let option: ChartOption;
  let series: Series;
  beforeEach(() => {
    option = projectGraphOption(graph, TEST_PALETTE);
    [series] = option.series as Series[];
  });

  it('draws a graph of the projects, one node each', () => {
    expect(series.type).toBe('graph');
    expect(series.data.map((n) => [n.id, n.name, n.category])).toEqual([
      ['backend', 'backend', 0],
      ['frontend', 'frontend', 0],
      ['frontend-e2e', 'frontend-e2e', 1],
      ['api-models', 'api-models', 2],
      ['query-parser', 'query-parser', 2],
      ['resume-metrics', 'resume-metrics', 2],
    ]);
  });

  it('points an arrow from each project to what it depends on', () => {
    expect(series.links).toEqual(graph.edges);
    expect(series.edgeSymbol).toEqual(['none', 'arrow']);
  });

  it('has a category per kind, in the legend', () => {
    expect(series.categories.map((c) => c.name)).toEqual(['Apps', 'End-to-end', 'Libraries']);
    expect(option.legend).toMatchObject({ data: ['Apps', 'End-to-end', 'Libraries'] });
  });

  it('colors each kind with a fixed palette slot and describes itself', () => {
    expect(option.color).toEqual([
      TEST_PALETTE.series[1],
      TEST_PALETTE.series[3],
      TEST_PALETTE.series[0],
    ]);
    expect(option.aria).toMatchObject({ enabled: true });
  });

  it('makes the nodes that more projects depend on bigger', () => {
    const size = (id: string) => series.data.find((n) => n.id === id)?.symbolSize ?? 0;
    expect(size('api-models')).toBeGreaterThan(size('query-parser')); // 3 dependents vs 2
    expect(size('query-parser')).toBeGreaterThan(size('backend')); // 2 vs 0
    expect(size('backend')).toBe(size('frontend-e2e'));
  });

  it('shows labels and the root folder in the tooltip', () => {
    expect(series).toMatchObject({ label: { show: true } });
    const tooltip = option.tooltip as {
      formatter: (p: { dataType: string; data: { name: string; value: string } }) => string;
    };
    expect(
      tooltip.formatter({
        dataType: 'node',
        data: { name: 'api-models', value: 'libs/shared/api-models' },
      }),
    ).toBe('api-models · libs/shared/api-models');
    expect(tooltip.formatter({ dataType: 'edge', data: { name: 'x', value: '' } })).toBe('');
  });

  it('copes with an empty graph', () => {
    const empty = projectGraphOption({ nodes: [], edges: [] }, TEST_PALETTE);
    expect((empty.series as { data: unknown[] }[])[0].data).toEqual([]);
  });
});
