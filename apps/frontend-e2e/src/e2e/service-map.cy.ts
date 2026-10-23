/** Service map against the real API and the seeded database. */
describe('Service map', () => {
  it('draws the graph and links each node to its view', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Service map').click();
    cy.location('pathname').should('eq', '/service-map');
    cy.get('app-echart canvas', { timeout: 10_000 }).should('exist');

    cy.get('button.panel-menu-toggle').click();
    cy.contains('[role="menuitem"]', 'Show as table').click();
    cy.contains('tbody tr', 'Technology').should('exist');
    cy.contains('tbody th a', 'Pierre O11y').click();
    cy.location('pathname').should('eq', '/traces/pierre-o11y');

    cy.go('back');
    cy.get('button.panel-menu-toggle').click();
    cy.contains('[role="menuitem"]', 'Show as table').click();
    cy.contains('tbody th a', /^NgRx$/).click();
    cy.location('pathname').should('eq', '/');
    cy.location('search').should('eq', '?skill=ngrx');
  });
});
