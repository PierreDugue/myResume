import type { NxGraphJson } from './inputs.ts';
import { projectGraphFromNx } from './project-graph.ts';

const nxGraph: NxGraphJson = {
  graph: {
    nodes: {
      'resume-metrics': { type: 'lib', data: { root: 'libs/shared/resume-metrics' } },
      'frontend-e2e': { type: 'e2e', data: { root: 'apps/frontend-e2e' } },
      frontend: { type: 'app', data: { root: 'apps/frontend' } },
      'api-models': { type: 'lib', data: { root: 'libs/shared/api-models' } },
      backend: { type: 'app', data: { root: 'apps/backend' } },
    },
    dependencies: {
      'resume-metrics': [{ source: 'resume-metrics', target: 'api-models', type: 'static' }],
      'frontend-e2e': [{ source: 'frontend-e2e', target: 'frontend', type: 'implicit' }],
      frontend: [
        { source: 'frontend', target: 'resume-metrics', type: 'static' },
        { source: 'frontend', target: 'npm:@angular/core', type: 'static' },
        { source: 'frontend', target: 'api-models', type: 'static' },
        // the same edge twice (static and dynamic import)
        { source: 'frontend', target: 'api-models', type: 'dynamic' },
      ],
      'api-models': [],
      backend: [
        { source: 'backend', target: 'api-models', type: 'static' },
        { source: 'backend', target: 'npm:@nestjs/core', type: 'static' },
      ],
    },
  },
};

describe('projectGraphFromNx', () => {
  it('lists apps, e2e projects, then libraries, by name within each', () => {
    expect(projectGraphFromNx(nxGraph).nodes).toEqual([
      { name: 'backend', kind: 'app', root: 'apps/backend' },
      { name: 'frontend', kind: 'app', root: 'apps/frontend' },
      { name: 'frontend-e2e', kind: 'e2e', root: 'apps/frontend-e2e' },
      { name: 'api-models', kind: 'lib', root: 'libs/shared/api-models' },
      { name: 'resume-metrics', kind: 'lib', root: 'libs/shared/resume-metrics' },
    ]);
  });

  it('keeps project-to-project edges once, by source then target, without npm packages', () => {
    expect(projectGraphFromNx(nxGraph).edges).toEqual([
      { source: 'backend', target: 'api-models' },
      { source: 'frontend', target: 'api-models' },
      { source: 'frontend', target: 'resume-metrics' },
      { source: 'frontend-e2e', target: 'frontend' },
      { source: 'resume-metrics', target: 'api-models' },
    ]);
  });

  it('is empty for an empty workspace', () => {
    expect(projectGraphFromNx({ graph: { nodes: {}, dependencies: {} } })).toEqual({
      nodes: [],
      edges: [],
    });
  });
});
