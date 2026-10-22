/** Sign-in journey. The API is stubbed (cy.intercept): no admin account is touched in the database. */
function fakeJwt(email: string, expiresInSeconds: number): string {
  const enc = (v: object) =>
    btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin-id', email, exp })}.sig`;
}

describe('admin sign-in', () => {
  const email = 'pierre@example.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.intercept('GET', '/api/auth/me', { id: 'admin-id', email }).as('me');
  });

  it('sends visitors from /admin to the login page', () => {
    cy.visit('/admin');
    cy.location('pathname').should('eq', '/admin/login');
    cy.location('search').should('eq', '?returnUrl=%2Fadmin');
    cy.get('nav[aria-label="Breadcrumb"] h1').should('contain', 'Sign in');
  });

  it('shows an error for wrong credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' },
    });
    cy.visit('/admin/login');
    cy.get('#login-email').type(email);
    cy.get('#login-password').type('wrong password');
    cy.contains('button', 'Sign in').click();
    cy.get('[role="alert"]').should('contain', 'Invalid email or password.');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('signs in, stays signed in after a reload, then signs out', () => {
    cy.intercept('POST', '/api/auth/login', {
      accessToken: fakeJwt(email, 3600),
      expiresIn: 3600,
    }).as('login');
    cy.visit('/');
    cy.get('aside a.sign-in').click();

    cy.get('#login-email').type(email);
    cy.get('#login-password').type('correct horse battery staple{enter}');
    cy.wait('@login')
      .its('request.body')
      .should('deep.equal', { email, password: 'correct horse battery staple' });

    cy.location('pathname').should('eq', '/admin');
    cy.wait('@me')
      .its('request.headers.authorization')
      .should('match', /^Bearer /);
    cy.contains('Signed in as').should('contain', email);

    cy.reload();
    cy.location('pathname').should('eq', '/admin');
    cy.get('aside a.admin-link').should('exist');

    cy.get('aside button.sign-out').click();
    cy.location('pathname').should('eq', '/');
    cy.get('aside a.sign-in').should('exist');
    cy.visit('/admin');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('goes back to the login page when the API rejects the session', () => {
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 401,
      body: { statusCode: 401, message: 'Unauthorized' },
    });
    cy.visit('/', {
      onBeforeLoad: (win) => win.localStorage.setItem('auth.token', fakeJwt(email, 3600)),
    });
    cy.visit('/admin');
    cy.location('pathname').should('eq', '/admin/login');
    cy.location('search').should('eq', '?returnUrl=%2Fadmin');
  });
});
