import { $ } from '../../testing';

import { field, type } from '../testing/render';
import {
  setUpEditorTests,
  adminProfile,
  api,
  badRequest,
  el,
  start,
  fieldErrors,
  formAlerts,
  header,
  job,
  projectArticle,
  educationArticle,
  tool,
  smallForm,
  buttonNamed,
  click,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('the dates form', () => {
    const datesOf = (title: string) => `Edit dates of "${title}"`;

    it('opens next to the item with the current dates, and closes with Cancel without a request', async () => {
      await start();
      const toggle = tool(datesOf('KX'));
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(field(smallForm(), 'Start date').value).toBe('2022-09-01');
      expect(field(smallForm(), 'End date').value).toBe('2025-11-30');

      type(field(smallForm(), 'End date'), '2024-01-01');
      await click(buttonNamed(smallForm(), 'Cancel'));
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(api.experiences.update).not.toHaveBeenCalled();

      await click(toggle);
      expect(field(smallForm(), 'End date').value).toBe('2025-11-30');
    });

    it.each([
      [
        'an end date before the start date',
        '2022-09-01',
        '2020-01-01',
        'The end date must be after the start date',
      ],
      ['no start date', '', '2025-11-30', 'Start date is required'],
    ])('refuses %s without sending anything', async (_name, from, to, message) => {
      await start();
      await click(tool(datesOf('KX')));
      type(field(smallForm(), 'Start date'), from);
      type(field(smallForm(), 'End date'), to);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([message]);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });

    it.each([
      {
        name: 'an experience, ending now',
        title: 'KX',
        start: '2022-09-01',
        end: '',
        resource: 'experiences' as const,
        id: 'e-kx',
        body: { startDate: '2022-09-01', endDate: null },
        article: () => job(1),
        period: 'Sep 2022 – Present',
      },
      {
        name: 'an education',
        title: 'ESIL',
        start: '2008-10-01',
        end: '2011-07-31',
        resource: 'education' as const,
        id: 'ed-esil',
        body: { startDate: '2008-10-01', endDate: '2011-07-31' },
        article: () => educationArticle(),
        period: 'Oct 2008 – Jul 2011',
      },
      {
        name: 'a project',
        title: 'Pierre O11y',
        start: '2026-10-01',
        end: '2026-12-31',
        resource: 'projects' as const,
        id: 'p-site',
        body: { startDate: '2026-10-01', endDate: '2026-12-31' },
        article: () => projectArticle(),
        period: 'Oct 2026 – Dec 2026',
      },
    ])('saves the dates of $name, an empty end date meaning current', async (c) => {
      await start();
      await click(tool(datesOf(c.title)));
      type(field(smallForm(), 'Start date'), c.start);
      type(field(smallForm(), 'End date'), c.end);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api[c.resource].update).toHaveBeenCalledTimes(1);
      expect(api[c.resource].update).toHaveBeenCalledWith(c.id, c.body);
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(c.article(), '.meta').textContent).toContain(c.period);
    });

    it('stays open with the API error when the dates are rejected', async () => {
      api.experiences.update.mockReturnValueOnce(badRequest('endDate must be a valid date'));
      await start();
      await click(tool(datesOf('KX')));
      type(field(smallForm(), 'End date'), '2025-12-31');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['endDate must be a valid date.']);
      expect(field(smallForm(), 'End date').value).toBe('2025-12-31');
    });
  });

  describe('the tech stack form', () => {
    const stackOf = (title: string) => `Edit tech stack of "${title}"`;
    const box = (id: string) =>
      $<HTMLInputElement>(smallForm(), `input[type="checkbox"][value="${id}"]`);

    it('offers every skill, checks the current stack, and saves the new one', async () => {
      await start();
      await click(tool(stackOf('KX')));
      expect(box('s-angular').checked).toBe(true);
      expect(box('s-ngrx').checked).toBe(true);
      expect(box('s-jest').checked).toBe(false);

      await click(box('s-jest'));
      await click(box('s-angular'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
        skillIds: ['s-ngrx', 's-jest'],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(job(1), '.stack').textContent).toMatch(/Tech stack:\s*NgRx, Jest/);
    });

    it('works the same for a project', async () => {
      await start();
      await click(tool(stackOf('Pierre O11y')));
      await click(box('s-ngrx'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.projects.update).toHaveBeenCalledWith('p-site', {
        skillIds: ['s-angular', 's-ngrx'],
      });
    });

    it('closes with Cancel without a request', async () => {
      await start();
      await click(tool(stackOf('KX')));
      await click(box('s-jest'));
      await click(buttonNamed(smallForm(), 'Cancel'));

      expect(el.querySelector('form.small-form')).toBeNull();
      expect(api.experiences.update).not.toHaveBeenCalled();
    });

    it('stays open with the API error when the stack is rejected', async () => {
      api.experiences.update.mockReturnValueOnce(badRequest('Unknown skill ids'));
      await start();
      await click(tool(stackOf('KX')));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['Unknown skill ids.']);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });
  });

  describe('the links form', () => {
    const openLinks = async () => click(tool('Edit links'));

    it('shows the current links and saves the profile with an added link and one removed', async () => {
      await start();
      await openLinks();
      expect(field(smallForm(), 'Link 1 label').value).toBe('LinkedIn');
      expect(field(smallForm(), 'Link 1 URL').value).toBe('https://www.linkedin.com/in/example');

      await click(buttonNamed(smallForm(), 'Add link'));
      type(field(smallForm(), 'Link 2 label'), 'GitHub');
      type(field(smallForm(), 'Link 2 URL'), 'https://github.com/example');
      await click($(smallForm(), 'button[aria-label="Remove link 1"]'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.saveProfile).toHaveBeenCalledTimes(1);
      expect(api.saveProfile).toHaveBeenCalledWith({
        ...adminProfile,
        links: [{ label: 'GitHub', url: 'https://github.com/example' }],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(header(), 'a[href="https://github.com/example"]').textContent).toContain('GitHub');
      expect(header().querySelector('a[href="https://www.linkedin.com/in/example"]')).toBeNull();
    });

    it.each([
      [
        'a URL that is not http(s)',
        'Link 1 URL',
        'javascript:alert(1)',
        'Enter a URL starting with http:// or https://',
      ],
      ['a link without a label', 'Link 1 label', '', 'Label is required'],
    ])('refuses %s without sending anything', async (_name, label, value, message) => {
      await start();
      await openLinks();
      type(field(smallForm(), label), value);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.saveProfile).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([message]);
    });

    it('stays open with the API error when the profile is rejected', async () => {
      api.saveProfile.mockReturnValueOnce(badRequest('links.0.url must be a URL address'));
      await start();
      await openLinks();
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['links.0.url must be a URL address.']);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });
  });
});
