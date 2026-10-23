export type ServiceMapNodeKind = 'job' | 'project' | 'skill';

export interface ServiceMapNode {
  /** Prefixed by kind, e.g. "skill:<uuid>". */
  id: string;
  kind: ServiceMapNodeKind;
  /** Company, project title or skill name. */
  label: string;
  /** Experience behind the node, 1 decimal: years of use for a skill, duration otherwise. */
  years: number;
  /** Skill or project slug. */
  slug: string | null;
  /** The skill's category. */
  category: string | null;
}

/** From a job or project node to one of its skill nodes. */
export interface ServiceMapEdge {
  source: string;
  target: string;
}

/** `GET /api/service-map`. */
export interface ServiceMapResponse {
  /** Jobs, then projects, then skills. */
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}
