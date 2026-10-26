/**
 * Cold start on free hosting (docs/spec.md, Cross-cutting requirements): the platform answers 502
 * while it wakes the backend. Here the first answers are stubbed with 502s, then the real API
 * (proxy → NestJS → PostgreSQL) answers.
 */
describe('cold start', () => {
  const proxyError = { statusCode: 502, body: '<html><body>Bad Gateway</body></html>' };

  it('shows that the backend is waking up, then loads the page by itself', () => {
    cy.intercept({ method: 'GET', url: '/api/health', times: 1 }, proxyError);
    cy.intercept({ method: 'GET', url: '/api/resume', times: 1 }, proxyError).as('firstTry');
    cy.visit('/resume');
    cy.wait('@firstTry');

    cy.get('.cold-start[role="status"]').should('contain', 'The backend is waking up');
    cy.get('.api-status').should('have.attr', 'data-status', 'starting');

    // The next health check (5 s later) reaches the backend, and the resume call was retried.
    cy.get('.cold-start', { timeout: 10_000 }).should('not.exist');
    cy.get('.api-status').should('have.attr', 'data-status', 'up');
    cy.get('header.resume-header h2').should('not.be.empty');
  });
});
