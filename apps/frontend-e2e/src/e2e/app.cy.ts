describe('frontend', () => {
  beforeEach(() => cy.visit('/'));

  it('should load the app shell', () => {
    cy.get('app-root').should('exist');
  });
});
