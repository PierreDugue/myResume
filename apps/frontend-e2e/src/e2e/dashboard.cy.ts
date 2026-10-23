/** Career Overview against the real API and the seeded database. */
describe('Career Overview dashboard', () => {
  it('shows the panels with real data and draws the charts', () => {
    cy.visit('/');
    cy.get('app-stat-panel', { timeout: 10_000 }).should('have.length', 6);
    cy.get('app-stat-panel .value').first().invoke('text').should('match', /\d+\+/);
    cy.get('app-career-timeline li.item').should('have.length.greaterThan', 3);
    cy.get('app-impact-list li.impact').should('have.length.greaterThan', 0);
    cy.get('app-echart').should('have.length', 2);
    // ECharts may use several canvas layers per chart: each chart must have drawn at least one.
    cy.get('app-echart').each((chart) =>
      cy.wrap(chart).find('canvas', { timeout: 10_000 }).should('exist'),
    );
  });

  it('keeps the range and filters in the URL', () => {
    cy.visit('/');
    cy.get('#dash-from option', { timeout: 10_000 }).should('have.length.greaterThan', 1);
    cy.get('#dash-from').select('2017');
    cy.location('search').should('contain', 'from=2017');
    cy.get('#dash-skill').select('NgRx');
    cy.location('search').should('contain', 'skill=ngrx');
    cy.get('app-echart canvas').should('exist');

    cy.reload();
    cy.get('#dash-from').should('have.value', '2017');
    cy.get('#dash-skill').should('have.value', 'ngrx');

    cy.contains('button', 'Whole career').click();
    cy.location('search').should('eq', '');
  });

  it('can show a chart as a table and inspect the raw data', () => {
    cy.visit('/');
    cy.contains('app-panel h2', 'Skills over time').parents('app-panel').as('usage');
    cy.get('@usage').find('button.panel-menu-toggle').click();
    cy.get('@usage').contains('[role="menuitem"]', 'Show as table').click();
    cy.get('@usage').find('table tbody tr').should('have.length.greaterThan', 0);

    cy.get('@usage').find('button.panel-menu-toggle').click();
    cy.get('@usage').contains('[role="menuitem"]', 'Inspect data').click();
    cy.get('[role="dialog"]').should('contain', '"series"');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
  });
});
