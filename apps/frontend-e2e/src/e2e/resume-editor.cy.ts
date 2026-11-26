/** The API is stubbed: no admin account or content is touched in the database. */
describe('edit the plain view in place (stubbed API)', () => {
  const enc = (v: object) =>
    btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${enc({ alg: 'HS256' })}.${enc({ sub: 'a', email: 'pierre@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.s`;
  const signIn = (win: Window) => win.localStorage.setItem('auth.token', token);

  const angular = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Angular',
    slug: 'angular',
    category: 'Core Frameworks',
    level: 5,
    sortOrder: 0,
  };
  const whoz = {
    id: '22222222-2222-4222-8222-222222222222',
    company: 'Whoz',
    role: 'Angular Front-End Engineer',
    location: 'Full Remote',
    startDate: '2026-05-01',
    endDate: null,
    summary: null,
    skillIds: [angular.id],
    highlights: [],
    sortOrder: 0,
  };
  const kx = {
    id: '33333333-3333-4333-8333-333333333333',
    company: 'KX',
    role: 'Lead Front-End Engineer',
    location: null,
    startDate: '2022-09-01',
    endDate: '2025-11-30',
    summary: null,
    skillIds: [angular.id],
    highlights: [],
    sortOrder: 1,
  };
  const profile = {
    fullName: 'Pierre Dugue',
    headline: 'Senior Front-End Engineer',
    summary: 'Senior Angular developer.',
    email: 'pierre@example.com',
    phone: null,
    showPhone: false,
    location: 'Nice, France',
    openToRelocation: false,
    avatarUrl: null,
    links: [],
    interests: null,
    yearsInIt: 14,
    yearsOfAngular: 9,
  };
  /** The public profile has no `showPhone` (undefined is dropped from the JSON). */
  const publicProfile = { ...profile, showPhone: undefined };

  beforeEach(() => {
    cy.intercept('GET', '/api/auth/me', { id: 'a', email: 'pierre@example.com' });
    cy.intercept('GET', '/api/resume', {
      profile: publicProfile,
      experiences: [whoz, kx],
      education: [],
      skills: [angular],
      projects: [],
    });
    cy.intercept('GET', '/api/profile', profile);
    cy.intercept('GET', '/api/skills', [angular]);
    cy.intercept('GET', '/api/experiences', [whoz, kx]);
    cy.intercept('GET', '/api/education', []);
    cy.intercept('GET', '/api/projects', []);
  });

  it('shows no Edit link to a visitor', () => {
    cy.visit('/resume');
    cy.get('header.resume-header h2', { timeout: 10_000 }).should('contain.text', 'Pierre Dugue');
    cy.get('a.edit-resume').should('not.exist');
  });

  it('lets the signed-in admin edit a role in place and saves it with a single-field PATCH', () => {
    cy.intercept('PATCH', `/api/experiences/${whoz.id}`, (req) =>
      req.reply({ ...whoz, ...req.body }),
    ).as('patch');

    cy.visit('/resume', { onBeforeLoad: signIn });
    cy.get('a.edit-resume', { timeout: 10_000 }).should('have.text', 'Edit').click();
    cy.location('pathname').should('eq', '/admin/resume');

    cy.get('section.experience article')
      .first()
      .contains('button.inline-text', 'Angular Front-End Engineer')
      .click();
    cy.focused().should('have.attr', 'aria-label', 'Role');
    cy.focused().clear();
    cy.focused().type('Staff Engineer{enter}');

    cy.wait('@patch').its('request.body').should('deep.equal', { role: 'Staff Engineer' });
    cy.contains('.save-status', 'Saved');
    cy.get('section.experience article').first().contains('button.inline-text', 'Staff Engineer');
  });
});
