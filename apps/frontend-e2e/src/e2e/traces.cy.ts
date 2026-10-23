/** Traces against the real API and the seeded database. */
describe('Traces', () => {
  it('lists the projects as traces and opens a waterfall', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Traces').click();
    cy.location('pathname').should('eq', '/traces');
    cy.contains('tbody a', 'Pierre O11y').click();

    cy.location('pathname').should('eq', '/traces/pierre-o11y');
    cy.get('h2').should('contain', 'Pierre O11y');
    cy.get('app-waterfall li.row').should('have.length.greaterThan', 5);
    cy.get('app-waterfall li.row').first().should('have.attr', 'aria-level', '1');
    cy.contains('app-waterfall li.row', 'Explore (logs)').as('explore');
    cy.get('@explore').should('have.attr', 'aria-level', '3');

    cy.get('@explore').find('button.summary').click();
    cy.get('@explore').find('.details').should('contain', 'LogQL');
    cy.get('@explore').find('.details a').contains('Angular').click();
    cy.location('search').should('eq', '?skill=angular');
  });

  it('says when a project has no trace', () => {
    cy.visit('/traces/no-such-project');
    cy.get('[role="alert"]').should('contain', 'No trace for this project');
  });
});
