import type { ProjectGraph, ProjectGraphNodeKind } from '@my-resume/api-models';
import type { ChartPalette } from '../../../shared/panels/chart-palette';
import type { ChartOption } from '../../../shared/panels/echart/echarts-loader';

/** Node kinds in legend order, with a fixed palette slot each (color follows the kind). */
const KINDS: { kind: ProjectGraphNodeKind; name: string; slot: number }[] = [
  { kind: 'app', name: 'Apps', slot: 1 },
  { kind: 'e2e', name: 'End-to-end', slot: 3 },
  { kind: 'lib', name: 'Libraries', slot: 0 },
];

/** Node size: grows with the number of projects that depend on it. */
function symbolSize(dependents: number): number {
  return 16 + 6 * Math.min(dependents, 5);
}

/** "Nx project graph": apps, e2e projects and libraries, with an arrow from a project to each dependency. */
export function projectGraphOption(graph: ProjectGraph, palette: ChartPalette): ChartOption {
  const dependents = (name: string) => graph.edges.filter((e) => e.target === name).length;
  return {
    aria: { enabled: true },
    color: KINDS.map((k) => palette.series[k.slot]),
    textStyle: { color: palette.text },
    tooltip: {
      formatter: (p: { dataType: string; data: { name: string; value: string } }) =>
        p.dataType === 'node' ? `${p.data.name} · ${p.data.value}` : '',
    },
    legend: { data: KINDS.map((k) => k.name), top: 0, textStyle: { color: palette.text } },
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
        zoom: 0.9,
        force: { repulsion: 260, edgeLength: [70, 150], gravity: 0.1 },
        categories: KINDS.map((k) => ({ name: k.name })),
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 8],
        label: { show: true, position: 'right', color: palette.text, fontSize: 11 },
        labelLayout: { hideOverlap: true },
        lineStyle: { color: palette.muted, width: 1, opacity: 0.9, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
        itemStyle: { borderColor: palette.surface, borderWidth: 2 },
        data: graph.nodes.map((n) => ({
          id: n.name,
          name: n.name,
          value: n.root,
          category: KINDS.findIndex((k) => k.kind === n.kind),
          symbolSize: symbolSize(dependents(n.name)),
        })),
        links: graph.edges.map((e) => ({ source: e.source, target: e.target })),
      },
    ],
  };
}
