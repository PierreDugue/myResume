/**
 * Page visibility (docs/spec.md, Admin area, Preferences). `/api/preferences` is stubbed, so the
 * real preferences in the database are never read or changed.
 */
describe('page preferences (stubbed API)', () => {
  const enc = (v: object) =>
    btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: 'a', email: 'pierre@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.s`;
  const allVisible = {
    overview: true,
    explore: true,
    traces: true,
    serviceMap: true,
    quality: true,
    about: true,
  };
  const stubPreferences = (pages: Partial<typeof allVisible>) =>
    cy.intercept('GET', '/api/preferences', { pages: { ...allVisible, ...pages } }).as('prefs');
  const menu = () => cy.get('nav[aria-label="Main"]');

  describe('as a visitor', () => {
    it('hides a disabled page from the menu and redirects its address to the home page', () => {
      stubPreferences({ explore: false });
      cy.visit('/explore');
      cy.wait('@prefs');
      cy.location('pathname').should('eq', '/');
      menu().contains('a', 'Career Overview');
      menu().contains('a', 'Traces');
      menu().contains('a', 'Explore').should('not.exist');
    });

    it('lands on the first enabled page when the home page is disabled', () => {
      stubPreferences({ overview: false });
      cy.visit('/');
      cy.location('pathname').should('eq', '/explore');
      menu().contains('a', 'Career Overview').should('not.exist');
      cy.get('a.brand').should('have.attr', 'href', '/explore');
    });

    it('keeps the plain view and the sign-in page reachable when every page is disabled', () => {
      stubPreferences({
        overview: false,
        explore: false,
        traces: false,
        serviceMap: false,
        quality: false,
        about: false,
      });
      cy.visit('/about-this-site');
      cy.location('pathname').should('eq', '/resume');
      cy.get('header.resume-header h2', { timeout: 10_000 }).should('not.be.empty');
      menu().find('a').should('have.length', 0);

      cy.visit('/admin/login');
      cy.location('pathname').should('eq', '/admin/login');
    });
  });

  describe('as the admin', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/auth/me', { id: 'a', email: 'pierre@example.com' });
    });

    it('sees a disabled page marked "Hidden" and can open it to preview', () => {
      stubPreferences({ explore: false });
      cy.visit('/admin', { onBeforeLoad: (w) => w.localStorage.setItem('auth.token', token) });
      menu().contains('a', 'Explore').should('contain', 'Hidden').click();
      cy.location('pathname').should('eq', '/explore');
    });

    it('turns a page off from the preferences and sees the menu change at once', () => {
      stubPreferences({});
      cy.intercept('PATCH', '/api/preferences', (req) =>
        req.reply({ pages: { ...allVisible, ...req.body.pages } }),
      ).as('save');
      cy.visit('/admin', { onBeforeLoad: (w) => w.localStorage.setItem('auth.token', token) });
      cy.get('nav[aria-label="Admin sections"]').contains('a', 'Preferences').click();
      cy.location('pathname').should('eq', '/admin/preferences');
      menu().contains('a', 'Traces').should('not.contain', 'Hidden');

      cy.get('fieldset').contains('label', 'Traces').find('input[type="checkbox"]').uncheck();
      cy.contains('button', 'Save preferences').click();

      cy.wait('@save')
        .its('request.body')
        .should('deep.equal', { pages: { ...allVisible, traces: false } });
      cy.contains('[role="status"]', 'Preferences saved');
      menu().contains('a', 'Traces').should('contain', 'Hidden');
    });
  });
});
