import type {
  ProjectGraph,
  ProjectGraphEdge,
  ProjectGraphNode,
  ProjectGraphNodeKind,
} from '@my-resume/api-models';
import type { NxGraphJson } from './inputs.ts';
import { compareStrings } from './numbers.ts';

const KIND_ORDER: readonly ProjectGraphNodeKind[] = ['app', 'e2e', 'lib'];

function nodeKind(type: string): ProjectGraphNodeKind {
  return type === 'app' || type === 'e2e' ? type : 'lib';
}

/** `nx graph --file` output → nodes (apps, e2e, libs; by name) and project-to-project edges (no npm packages, no duplicates). */
export function projectGraphFromNx(nx: NxGraphJson): ProjectGraph {
  const nodes: ProjectGraphNode[] = Object.entries(nx.graph.nodes)
    .map(([name, node]) => ({ name, kind: nodeKind(node.type), root: node.data.root }))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || compareStrings(a.name, b.name),
    );

  const projects = new Set(nodes.map((node) => node.name));
  const edges = new Map<string, ProjectGraphEdge>();
  for (const dependencies of Object.values(nx.graph.dependencies)) {
    for (const { source, target } of dependencies) {
      if (projects.has(source) && projects.has(target)) {
        edges.set(`${source}\u0000${target}`, { source, target });
      }
    }
  }

  return {
    nodes,
    edges: [...edges.values()].sort(
      (a, b) => compareStrings(a.source, b.source) || compareStrings(a.target, b.target),
    ),
  };
}
