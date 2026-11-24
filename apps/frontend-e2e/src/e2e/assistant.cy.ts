/**
 * "Ask my resume" assistant (docs/spec.md, Build order step 12a). `GET /api/preferences` and
 * `POST /api/assistant/ask` are stubbed, so the real preferences are never read or changed and the
 * real assistant (and Gemini) is never called. The rest of the site uses the real API.
 */
describe('Ask my resume assistant (stubbed API)', () => {
  const allVisible = {
    overview: true,
    explore: true,
    traces: true,
    serviceMap: true,
    quality: true,
    siteMetrics: true,
    about: true,
  };
  const stubPreferences = (assistant: { enabled: boolean; configured: boolean }) =>
    cy
      .intercept('GET', '/api/preferences', {
        pages: allVisible,
        overview: { skillsOverTime: [] },
        assistant,
      })
      .as('prefs');
  const enabled = { enabled: true, configured: true };
  const toggle = () => cy.get('button[aria-controls="assistant-panel"]');
  const panel = () => cy.get('#assistant-panel');
  const ask = (question: string) => {
    panel().find('textarea').type(`${question}{enter}`);
  };

  beforeEach(() => {
    cy.viewport(1280, 800);
  });

  it('is not offered when the admin has not turned it on', () => {
    stubPreferences({ enabled: false, configured: true });
    cy.visit('/');
    cy.wait('@prefs');
    cy.get('header.topbar').should('be.visible');
    toggle().should('not.exist');
    cy.get('#assistant-panel').should('not.exist');
  });

  it('is not offered when the server has no key', () => {
    stubPreferences({ enabled: true, configured: false });
    cy.visit('/');
    cy.wait('@prefs');
    cy.get('header.topbar').should('be.visible');
    toggle().should('not.exist');
  });

  it('is collapsed at first, then answers a question and opens it in Explore', () => {
    stubPreferences(enabled);
    cy.intercept('POST', '/api/assistant/ask', {
      answer: 'Pierre has two degrees.',
      explore: { query: '{type="education"}', matches: 2 },
    }).as('ask');
    cy.visit('/');
    cy.wait('@prefs');

    toggle().should('have.attr', 'aria-expanded', 'false');
    cy.get('#assistant-panel').should('not.exist');

    toggle().click();
    toggle().should('have.attr', 'aria-expanded', 'true');
    panel().should('be.visible');
    ask('What did Pierre study?');

    cy.wait('@ask')
      .its('request.body')
      .should('deep.equal', { question: 'What did Pierre study?' });
    panel().should('contain', 'What did Pierre study?').and('contain', 'Pierre has two degrees.');
    panel().should('contain', '2 matching log lines');

    panel().contains('a', 'Open in Explore').click();
    cy.location('pathname').should('eq', '/explore');
    cy.location('search').should('contain', 'query=');
    cy.get('input[role="combobox"]').should('have.value', '{type="education"}');
  });

  it('closes with Escape and keeps the conversation when reopened', () => {
    stubPreferences(enabled);
    cy.intercept('POST', '/api/assistant/ask', { answer: 'Ten years.', explore: null }).as('ask');
    cy.visit('/');
    cy.wait('@prefs');
    toggle().click();
    ask('How long in IT?');
    panel().should('contain', 'Ten years.');

    // No re-focusing: the focus must still be in the box after the answer.
    cy.focused().should('match', 'textarea').type('{esc}');
    toggle().should('have.attr', 'aria-expanded', 'false').and('have.focus');
    panel().should('not.be.visible');

    toggle().click();
    panel().should('be.visible').and('contain', 'How long in IT?').and('contain', 'Ten years.');
  });

  it('is also offered on the plain view', () => {
    stubPreferences(enabled);
    cy.visit('/resume');
    cy.wait('@prefs');
    toggle().should('exist');
  });

  it('explains the rate limit', () => {
    stubPreferences(enabled);
    cy.intercept('POST', '/api/assistant/ask', {
      statusCode: 429,
      body: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
    }).as('ask');
    cy.visit('/');
    cy.wait('@prefs');
    toggle().click();
    ask('One more?');
    cy.wait('@ask');
    panel().should(
      'contain',
      "You've asked a lot of questions in a short time. Try again in a few minutes.",
    );
  });

  it('is never offered on the admin pages', () => {
    stubPreferences(enabled);
    cy.visit('/admin/login');
    cy.wait('@prefs');
    cy.location('pathname').should('eq', '/admin/login');
    toggle().should('not.exist');
  });
});
