/** Explore (logs) against the real API and the seeded database. */
describe('Explore', () => {
  const query = () => cy.get('input[role="combobox"]');
  const lines = () => cy.get('app-log-list li.line');

  it('is in the main navigation and lists the resume as log lines', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Explore').click();
    cy.location('pathname').should('eq', '/explore');
    lines().should('have.length.greaterThan', 10);
    cy.get('app-echart canvas', { timeout: 10_000 }).should('exist');
  });

  it('runs a query typed with autocomplete, and keeps it in the URL', () => {
    cy.visit('/explore');
    lines().should('have.length.greaterThan', 10);

    query().type('{{}ty');
    cy.contains('[role="option"]', 'type').should('be.visible');
    query().type('{downArrow}{enter}');
    query().should('have.value', '{type="');
    cy.contains('[role="option"]', 'education').click();
    query().type('}{enter}');

    cy.location('search').should('contain', 'query=');
    lines().should('have.length', 2);
    lines().each((line) => cy.wrap(line).should('contain', 'MILESTONE'));

    cy.reload();
    query().should('have.value', '{type="education"}');
    lines().should('have.length', 2);
  });

  it('points at a mistake in the query without calling the server', () => {
    cy.visit('/explore');
    lines().should('have.length.greaterThan', 0);
    query().type('{{}company "KX"}{enter}');
    cy.get('[role="alert"]').should('contain', 'column 10');
    cy.location('search').should('eq', '');
  });

  it('narrows the query from the labels of a line', () => {
    cy.visit('/explore?query=%7Btype%3D%22experience%22%7D');
    lines().first().find('button.summary').click();
    lines().first().find('button[aria-label^="Filter for company="]').click();
    query()
      .invoke('val')
      .should('match', /^\{type="experience", company="[^"]+"\}$/);
    lines().should('have.length.greaterThan', 0);
  });

  it('finds achievements by technology', () => {
    cy.visit('/explore');
    cy.contains('button.example', '{tech="Angular"}').click();
    lines().should('have.length.greaterThan', 0);
    lines().first().find('button.summary').click();
    lines().first().find('.details').should('contain', 'Angular');
  });
});
