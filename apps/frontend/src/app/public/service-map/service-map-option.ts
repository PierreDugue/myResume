import type { ServiceMapNode, ServiceMapNodeKind, ServiceMapResponse } from '@my-resume/api-models';
import { withLabelMatcher } from '@my-resume/query-parser';
import type { ChartPalette } from '../../shared/panels/chart-palette';
import type { ChartOption } from '../../shared/panels/echart/echarts-loader';

/** Node kinds in legend order, with a fixed palette slot each (color follows the kind). */
export const NODE_KINDS: {
  kind: ServiceMapNodeKind;
  name: string;
  single: string;
  slot: number;
}[] = [
  { kind: 'job', name: 'Jobs', single: 'Job', slot: 1 },
  { kind: 'project', name: 'Projects', single: 'Project', slot: 3 },
  { kind: 'skill', name: 'Technologies', single: 'Technology', slot: 0 },
];

/** Node size: grows with the square root of the years, so large values don't swamp the graph. */
function symbolSize(years: number): number {
  return Math.round(Math.min(40, 8 + 9 * Math.sqrt(years)));
}

/** "Service map": a force-directed graph of jobs, projects and technologies. */
export function serviceMapOption(map: ServiceMapResponse, palette: ChartPalette): ChartOption {
  const category = (kind: ServiceMapNodeKind) => NODE_KINDS.findIndex((k) => k.kind === kind);
  return {
    aria: { enabled: true },
    color: NODE_KINDS.map((k) => palette.series[k.slot]),
    textStyle: { color: palette.text },
    tooltip: {
      formatter: (p: { dataType: string; data: { name: string; value: number } }) =>
        p.dataType === 'node' ? `${p.data.name} · ${p.data.value} yrs` : '',
    },
    legend: {
      data: NODE_KINDS.map((k) => k.name),
      top: 0,
      textStyle: { color: palette.text },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        top: 40,
        bottom: 16,
        left: 16,
        right: 16,
        // The force layout doesn't keep nodes in the box: gravity pulls them to the center,
        // and the graph starts slightly zoomed out (visitors can pan and zoom).
        zoom: 0.8,
        force: { repulsion: 220, edgeLength: [50, 130], gravity: 0.12 },
        categories: NODE_KINDS.map((k) => ({ name: k.name })),
        label: { show: true, position: 'right', color: palette.text, fontSize: 11 },
        labelLayout: { hideOverlap: true },
        lineStyle: { color: palette.border, width: 1, opacity: 0.9, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
        itemStyle: { borderColor: palette.surface, borderWidth: 2 },
        data: map.nodes.map((n) => ({
          id: n.id,
          name: n.label,
          value: n.years,
          category: category(n.kind),
          symbolSize: symbolSize(n.years),
        })),
        links: map.edges.map((e) => ({ source: e.source, target: e.target })),
      },
    ],
  };
}

/**
 * Where a node leads: a technology filters the dashboard, a project opens its trace, a job
 * searches its achievements in Explore.
 */
export function nodeLink(node: ServiceMapNode | undefined): {
  path: string;
  queryParams: Record<string, string>;
} {
  if (node?.kind === 'skill' && node.slug) return { path: '/', queryParams: { skill: node.slug } };
  if (node?.kind === 'project' && node.slug)
    return { path: `/traces/${node.slug}`, queryParams: {} };
  if (node?.kind === 'job') {
    return {
      path: '/explore',
      queryParams: { query: withLabelMatcher('', 'company', node.label) },
    };
  }
  return { path: '/', queryParams: {} };
}
