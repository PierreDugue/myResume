describe('app shell', () => {
  beforeEach(() => cy.clearLocalStorage());

  it('opens on the career overview with the main navigation', () => {
    cy.visit('/');
    cy.title().should('match', /^Career Overview · /);
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'Career Overview');
    cy.get('nav[aria-label="Main"]')
      .contains('a', 'Career Overview')
      .should('have.attr', 'aria-current', 'page');
  });

  it('goes to the plain view from the top bar', () => {
    cy.visit('/');
    cy.get('header a.plain-view').click();
    cy.location('pathname').should('eq', '/resume');
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'Plain view');
  });

  it('switches to the light theme and remembers it after a reload', () => {
    cy.visit('/');
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.get('button.theme-toggle').click();
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.reload();
    cy.get('html').should('have.attr', 'data-theme', 'light');
  });

  it('shows a not-found page with a way back home', () => {
    cy.visit('/does-not-exist');
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'Page not found');
    cy.get('main').contains('a', /home/i).click();
    cy.location('pathname').should('eq', '/');
  });

  it('shows that the API is up (full stack: proxy → NestJS → PostgreSQL)', () => {
    cy.visit('/');
    cy.get('.api-status', { timeout: 10_000 }).should('have.attr', 'data-status', 'up');
  });
});
