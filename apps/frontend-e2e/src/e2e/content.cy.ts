describe('plain view (real API and database)', () => {
  it('shows the resume from the API, with experiences and a print button', () => {
    cy.visit('/resume');
    cy.get('header.resume-header h2', { timeout: 10_000 }).should('not.be.empty');
    cy.get('section.experience article').should('have.length.greaterThan', 0);
    cy.get('section.experience article')
      .first()
      .find('.meta')
      .invoke('text')
      .should('match', /\d{4}/);
    cy.get('button.print').should('be.visible');
    cy.get('a[href^="tel:"]').should('not.exist');
  });
});

/** The API is stubbed: no admin account or content is touched in the database. */
describe('admin content (stubbed API)', () => {
  const enc = (v: object) =>
    btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: 'a', email: 'pierre@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.s`;
  const angular = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Angular',
    slug: 'angular',
    category: 'Core Frameworks',
    level: 5,
    sortOrder: 0,
  };

  beforeEach(() => {
    cy.intercept('GET', '/api/auth/me', { id: 'a', email: 'pierre@example.com' });
    cy.intercept('GET', '/api/skills', [angular]).as('skills');
  });

  it('creates a skill from the admin and comes back to the list', () => {
    cy.intercept('POST', '/api/skills', (req) =>
      req.reply(201, {
        ...angular,
        ...req.body,
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'vitest',
        sortOrder: 1,
      }),
    ).as('create');
    cy.visit('/admin', { onBeforeLoad: (w) => w.localStorage.setItem('auth.token', token) });
    cy.get('nav[aria-label="Admin sections"]').contains('a', 'Skills').click();
    cy.location('pathname').should('eq', '/admin/skills');
    cy.contains('li a.title', 'Angular');

    cy.contains('a', 'Add skill').click();
    cy.get('#skill-name').type('Vitest');
    cy.get('#skill-category').type('Testing & Tools');
    cy.get('#skill-level').select('4 / 5');
    cy.contains('button', 'Create skill').click();

    cy.wait('@create')
      .its('request.body')
      .should('deep.equal', { name: 'Vitest', category: 'Testing & Tools', level: 4 });
    cy.location('pathname').should('eq', '/admin/skills');
  });

  it('keeps visitors out of the admin', () => {
    cy.visit('/admin/skills');
    cy.location('pathname').should('eq', '/admin/login');
  });
});
