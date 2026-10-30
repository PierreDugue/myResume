/** "How this site was built" against the real API and the seeded database. */
describe('About this site', () => {
  it('opens from the main navigation and shows live content counts', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'About this site').click();
    cy.location('pathname').should('eq', '/about-this-site');
    cy.title().should('match', /^About this site · /);
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'About this site');

    cy.contains('app-panel', 'Live from the API').within(() => {
      cy.contains('app-stat-panel', 'Experiences', { timeout: 10_000 })
        .find('.value')
        .invoke('text')
        .should('match', /^\s*[1-9]\d*\s*$/);
    });
  });
});
