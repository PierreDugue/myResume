import type { Profile } from '@my-resume/api-models';
import { Subject, throwError } from 'rxjs';
import { $ } from '../../testing';

import {
  setUpEditorTests,
  adminProfile,
  server,
  api,
  el,
  settle,
  start,
  visible,
  inline,
  texts,
  header,
  job,
  companies,
  projectArticle,
  educationArticle,
  skillsSection,
  hasTool,
  click,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('loading', () => {
    it('shows the profile, skills and interests as the plain view lays them out', async () => {
      await start();
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
      expect(visible(inline(header(), 'Headline'))).toBe(
        'Senior Front-End Engineer | Angular Specialist',
      );
      expect(visible(inline(header(), 'Email'))).toBe('pierre@example.com');
      expect(visible(inline(header(), 'Location'))).toBe('Nice, France');
      expect(visible(inline(header(), 'Summary'))).toBe('Senior Angular developer.');
      expect($(header(), 'a[href="https://www.linkedin.com/in/example"]').textContent).toContain(
        'LinkedIn',
      );

      expect(texts('section.skills dt')).toEqual([
        'Core Frameworks',
        'State & Reactive',
        'Testing & Tools',
      ]);
      expect(
        [...skillsSection().querySelectorAll('dd')].map((dd) => visible(inline(dd, 'Name'))),
      ).toEqual(['Angular', 'NgRx', 'Jest']);
      expect(visible(inline($(el, 'section.interests'), 'Interests'))).toBe(
        'Guitar and photography.',
      );
    });

    it('lists the experiences in order, with their texts, achievements, period and tech stack', async () => {
      await start();
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
      expect(visible(inline(job(1), 'Location'))).toBe('Full Remote');
      expect(visible(inline(job(1), 'Summary'))).toBe(
        'Led front-end development of a data visualization platform.',
      );
      expect(
        [...job(1).querySelectorAll('li.highlight')].map((li) =>
          visible(inline(li, 'Achievement')),
        ),
      ).toEqual(['Cut average page load time by 35%.', 'Introduced an NX monorepo.']);
      expect($(job(1), '.meta').textContent).toContain('Sep 2022 – Nov 2025');
      expect($(job(0), '.meta').textContent).toContain('May 2026 – Present');
      expect($(job(1), '.stack').textContent).toMatch(/Angular, NgRx/);
    });

    it('invites the owner to fill in an empty optional text', async () => {
      await start();
      const summary = inline(job(0), 'Summary');
      expect(visible(summary)).toBe('Add summary');
      expect(visible(inline(educationArticle(), 'Description'))).toBe('Add description');
    });

    it('shows the projects and the education', async () => {
      await start();
      expect(visible(inline(projectArticle(), 'Title'))).toBe('Pierre O11y');
      expect(visible(inline(projectArticle(), 'Description'))).toBe('This site.');
      expect(visible(inline(educationArticle(), 'School'))).toBe('ESIL');
      expect(visible(inline(educationArticle(), 'Degree'))).toBe("Diplôme d'ingénieur");
      expect(visible(inline(educationArticle(), 'Field'))).toBe('Computer Science');
      expect(visible(inline(educationArticle(), 'Location'))).toBe('Marseille, France');
      expect($(educationArticle(), '.meta').textContent).toContain('Sep 2008 – Jun 2011');
    });

    it('keeps the phone hidden when the profile does not show it', async () => {
      await start();
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
      expect(el.textContent).not.toContain('+33 6 00 00 00 00');
      expect(() => inline(header(), 'Phone')).toThrow();
    });

    it('shows the phone, editable, when the profile shows it', async () => {
      server.profile = { ...adminProfile, showPhone: true };
      await start();
      expect(visible(inline(header(), 'Phone'))).toBe('+33 6 00 00 00 00');
    });

    it('links back to the public resume', async () => {
      await start();
      const link = [...el.querySelectorAll('a')].find(
        (a) => a.textContent?.trim() === 'View public resume',
      );
      expect(link?.getAttribute('href')).toBe('/resume');
    });

    it('shows Loading… until the content arrives', async () => {
      const profileReply = new Subject<Profile | null>();
      api.profile.mockReturnValueOnce(profileReply);
      await start();
      expect(el.textContent).toContain('Loading…');
      expect(el.querySelector('header.resume-header')).toBeNull();

      profileReply.next(structuredClone(adminProfile));
      profileReply.complete();
      await settle();
      expect(el.textContent).not.toContain('Loading…');
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
    });

    it('shows a retry button when the content cannot be loaded, and loads it again on retry', async () => {
      api.experiences.list.mockReturnValueOnce(throwError(() => new Error('offline')));
      await start();
      expect(el.querySelector('section.experience')).toBeNull();

      await click($(el, 'button.retry'));
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(el.querySelector('button.retry')).toBeNull();
    });
  });

  describe('links to the full forms', () => {
    it.each([
      ['an experience', 'KX', '/admin/experiences/e-kx'],
      ['an education', 'ESIL', '/admin/education/ed-esil'],
      ['a project', 'Pierre O11y', '/admin/projects/p-site'],
      ['a skill', 'NgRx', '/admin/skills/s-ngrx'],
      ['the profile', 'Profile', '/admin/profile'],
    ])('opens the full form of %s', async (_name, title, href) => {
      await start();
      const link = $<HTMLAnchorElement>(el, `a[aria-label='Full form for "${title}"']`);
      expect(link.textContent?.trim()).toBe('Full form');
      expect(link.getAttribute('href')).toBe(href);
    });

    it('gives the profile no move or delete buttons, only its links form and full form', async () => {
      await start();
      expect(hasTool('Move "Profile" up')).toBe(false);
      expect(hasTool('Move "Profile" down')).toBe(false);
      expect(hasTool('Delete "Profile"')).toBe(false);
      expect(hasTool('Edit links')).toBe(true);
    });

    it('offers only the small forms that fit each item', async () => {
      await start();
      expect(hasTool('Edit dates of "KX"')).toBe(true);
      expect(hasTool('Edit tech stack of "KX"')).toBe(true);
      expect(hasTool('Edit dates of "ESIL"')).toBe(true);
      expect(hasTool('Edit tech stack of "ESIL"')).toBe(false);
      expect(hasTool('Edit dates of "Angular"')).toBe(false);
      expect(hasTool('Edit tech stack of "Angular"')).toBe(false);
    });

    it('still leads to the profile form when there is no profile yet', async () => {
      server.profile = null;
      await start();
      expect(el.querySelector('header.resume-header')).toBeNull();
      expect($(el, `a[aria-label='Full form for "Profile"']`).getAttribute('href')).toBe(
        '/admin/profile',
      );
      expect(hasTool('Edit links')).toBe(false);
      expect(companies()).toEqual(['Whoz', 'KX']);
    });
  });
});
