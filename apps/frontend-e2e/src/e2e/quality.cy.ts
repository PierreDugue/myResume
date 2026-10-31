import type { QualityReport } from '@my-resume/api-models';

/**
 * Quality dashboard ("This codebase, observed"). `GET /api/quality` is stubbed: the real report
 * only exists in builds made by the CI pipeline.
 */
const counts = (passed: number, failed: number, skipped: number) => ({
  total: passed + failed + skipped,
  passed,
  failed,
  skipped,
  passRate: Math.round((passed / (passed + failed)) * 1000) / 10,
});

const report: QualityReport = {
  schemaVersion: 1,
  generatedAt: '2026-10-31T14:02:11Z',
  build: {
    commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    commitUrl: 'https://github.com/PierreDugue/myResume/commit/a1b2c3d4e5f6',
    branch: 'main',
    runUrl: 'https://github.com/PierreDugue/myResume/actions/runs/123456',
    startedAt: '2026-10-31T13:56:00Z',
    durationSeconds: 372,
    jobs: [
      { name: 'Unit tests', durationSeconds: 210 },
      { name: 'Build', durationSeconds: 150 },
    ],
  },
  tests: {
    total: counts(694, 2, 4),
    suites: [
      { suite: 'unit', ...counts(636, 0, 4) },
      { suite: 'integration', ...counts(58, 2, 0) },
    ],
    projects: [
      { project: 'frontend', suite: 'unit', ...counts(636, 0, 4) },
      { project: 'backend', suite: 'integration', ...counts(58, 2, 0) },
    ],
  },
  coverage: [
    {
      project: 'frontend',
      kind: 'app',
      suite: 'unit',
      metrics: { lines: 87.3, statements: 86.9, functions: 80.4, branches: 75.6 },
    },
    {
      project: 'query-parser',
      kind: 'lib',
      suite: 'unit',
      metrics: { lines: 96.5, statements: 96.1, functions: 100, branches: 92.3 },
    },
  ],
  bundle: {
    initialBytes: 412340,
    lazyBytes: 1204500,
    budgetWarningBytes: 500000,
    budgetErrorBytes: 1000000,
  },
  lighthouse: null,
  projectGraph: {
    nodes: [
      { name: 'frontend', kind: 'app', root: 'apps/frontend' },
      { name: 'api-models', kind: 'lib', root: 'libs/shared/api-models' },
    ],
    edges: [{ source: 'frontend', target: 'api-models' }],
  },
};

describe('Quality dashboard', () => {
  it('shows the report of the build, from the main navigation', () => {
    cy.intercept('GET', '/api/quality', report).as('quality');
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Code quality').click();
    cy.wait('@quality');
    cy.location('pathname').should('eq', '/dashboards/quality');
    cy.title().should('match', /^This codebase, observed · /);
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'This codebase, observed');

    cy.contains('app-stat-panel', 'Tests').find('.value').should('contain', '700');
    cy.contains('app-stat-panel', 'Initial bundle').find('.hint').should('contain', 'of 500.0 kB');
    cy.contains('app-stat-panel', 'Last deploy')
      .find('.value')
      .should('contain', '2026-10-31 14:02 UTC');

    cy.contains('app-panel', 'Code coverage')
      .contains('li', 'frontend')
      .should('contain', '87.3 %');

    // Lighthouse is not measured yet: said in the panel, not an error.
    cy.contains('app-panel', 'Lighthouse').should('contain', 'Not measured yet');
    cy.get('[role="alert"]').should('not.exist');

    // The graph has a table alternative.
    cy.contains('app-panel', 'Nx project graph').within(() => {
      cy.get('button.panel-menu-toggle').click();
      cy.contains('[role="menuitem"]', 'Show as table').click();
      cy.contains('tbody tr', 'frontend').should('contain', 'api-models');
    });
  });

  it('explains that a build without a report has none (404)', () => {
    cy.intercept('GET', '/api/quality', {
      statusCode: 404,
      body: { statusCode: 404, message: 'No quality report in this build', error: 'Not Found' },
    }).as('quality');
    cy.visit('/dashboards/quality');
    cy.wait('@quality');
    cy.get('.empty-state').should('contain', 'CI pipeline').and('contain', 'no quality report');
    cy.get('[role="alert"]').should('not.exist');
    cy.get('app-panel').should('not.exist');
  });
});
