/**
 * "This site, observed" (/dashboards/meta): the health of the backend's own Node.js process,
 * streamed over the real WebSocket and polled over the real HTTP endpoint (nothing is stubbed:
 * the data is the running backend's own).
 */
describe('Site metrics dashboard', () => {
  const inspector = () => cy.contains('app-panel', 'Stream inspector');

  it('is in the main navigation and streams live over the WebSocket', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Main"]').contains('a', 'Site metrics').click();
    cy.location('pathname').should('eq', '/dashboards/meta');
    cy.title().should('match', /^This site, observed · /);
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'This site, observed');

    // Connected: the badge says LIVE, and a tick shows in the inspector within a few seconds.
    cy.get('app-live-badge', { timeout: 15_000 }).should('contain.text', 'LIVE');
    inspector().contains('li', 'metrics:tick', { timeout: 10_000 });
    inspector().contains('li', 'subscribe:metrics');

    // The history filled the dashboard: six stats and the four charts.
    cy.get('app-stat-panel', { timeout: 10_000 }).should('have.length', 6);
    cy.contains('app-stat-panel', 'Uptime').find('.value').should('not.be.empty');
    for (const title of ['Event loop lag', 'Memory', 'CPU', 'Garbage collection']) {
      cy.contains('app-panel', title).find('app-echart [role="img"]').should('exist');
    }
    cy.get('[role="alert"]').should('not.exist');
  });

  it('keeps receiving ticks: the newest sample moves on', () => {
    cy.visit('/dashboards/meta');
    cy.get('app-live-badge', { timeout: 15_000 }).should('contain.text', 'LIVE');
    cy.contains('app-panel', 'Memory').within(() => {
      cy.get('button.panel-menu-toggle').click();
      cy.contains('[role="menuitem"]', 'Show as table').click();
    });
    cy.contains('app-panel', 'Memory')
      .find('tbody tr:first-child th')
      .invoke('text')
      .then((first) => {
        cy.contains('app-panel', 'Memory')
          .find('tbody tr:first-child th', { timeout: 10_000 })
          .should(($th) => expect($th.text()).not.to.equal(first));
      });
  });

  it('switches to HTTP polling, says so in the URL and the badge, and back to live', () => {
    cy.visit('/dashboards/meta');
    cy.get('app-live-badge', { timeout: 15_000 }).should('contain.text', 'LIVE');

    cy.contains('app-refresh-picker button', '5s').click();
    cy.location('search').should('eq', '?refresh=5s');
    cy.get('app-live-badge').should('contain.text', 'Polling every 5s');
    cy.contains('app-refresh-picker button', '5s').should('have.attr', 'aria-pressed', 'true');
    inspector().contains('li', 'GET /api/site-metrics/process');
    cy.get('app-stat-panel').should('have.length', 6);

    cy.contains('app-refresh-picker button', 'Live').click();
    cy.location('search').should('eq', '');
    cy.get('app-live-badge', { timeout: 15_000 }).should('contain.text', 'LIVE');
  });

  it('opens straight in a refresh mode from the URL', () => {
    cy.visit('/dashboards/meta?refresh=off');
    cy.get('app-live-badge').should('contain.text', 'Off');
    cy.get('app-stat-panel', { timeout: 10_000 }).should('have.length', 6);
  });
});
