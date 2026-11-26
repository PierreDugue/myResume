import type { HighlightInput } from '@my-resume/api-models';
import { Subject } from 'rxjs';
import { $ } from '../../testing';

import { field, type } from '../testing/render';
import {
  setUpEditorTests,
  Entity,
  rxjs,
  server,
  serverReorder,
  api,
  badRequest,
  el,
  settle,
  start,
  visible,
  inline,
  open,
  write,
  statuses,
  fieldErrors,
  formAlerts,
  job,
  companies,
  skillsSection,
  highlight,
  tool,
  hasTool,
  smallForm,
  buttonNamed,
  click,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('adding an item', () => {
    const addButton = (section: string, label: string) =>
      buttonNamed($(el, `section.${section}`), label);

    it('adds an experience at the end of the section, after the required fields are filled', async () => {
      await start();
      await click(addButton('experience', 'Add experience'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([
        'Company is required',
        'Role is required',
        'Start date is required',
      ]);

      type(field(smallForm(), 'Company'), ' Acme ');
      type(field(smallForm(), 'Role'), 'Engineer');
      type(field(smallForm(), 'Start date'), '2027-01-01');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.create).toHaveBeenCalledTimes(1);
      expect(api.experiences.create).toHaveBeenCalledWith({
        company: 'Acme',
        role: 'Engineer',
        location: null,
        startDate: '2027-01-01',
        endDate: null,
        summary: null,
        skillIds: [],
        highlights: [],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(companies()).toEqual(['Whoz', 'KX', 'Acme']);
      expect(visible(inline(job(2), 'Role'))).toBe('Engineer');
    });

    it('adds a skill into its category group', async () => {
      await start();
      await click(addButton('skills', 'Add skill'));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.skills.create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual(['Name is required', 'Category is required']);

      type(field(smallForm(), 'Name'), 'Signals');
      type(field(smallForm(), 'Category'), 'State & Reactive');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.skills.create).toHaveBeenCalledWith({
        name: 'Signals',
        category: 'State & Reactive',
        level: null,
      });
      const group = [...skillsSection().querySelectorAll('dd')][1];
      expect([...group.querySelectorAll('button.inline-text')].map((b) => visible(b))).toEqual([
        'NgRx',
        'Signals',
      ]);
    });

    it.each([
      {
        name: 'an education',
        section: 'education',
        button: 'Add education',
        required: ['School is required', 'Degree is required', 'Start date is required'],
        fill: { School: 'MIT', Degree: 'MSc', 'Start date': '2012-09-01' },
        resource: 'education' as const,
        body: {
          school: 'MIT',
          degree: 'MSc',
          field: null,
          location: null,
          startDate: '2012-09-01',
          endDate: null,
          description: null,
        },
        visibleAfter: () =>
          visible(inline($(el, 'section.education article:nth-of-type(2)'), 'School')),
        shown: 'MIT',
      },
      {
        name: 'a project',
        section: 'projects',
        button: 'Add project',
        required: ['Title is required', 'Description is required'],
        fill: { Title: 'Side project', Description: 'A small one.' },
        resource: 'projects' as const,
        body: {
          title: 'Side project',
          description: 'A small one.',
          url: null,
          repoUrl: null,
          imageUrl: null,
          startDate: null,
          endDate: null,
          skillIds: [],
          spans: [],
        },
        visibleAfter: () =>
          visible(inline($(el, 'section.projects article:nth-of-type(2)'), 'Title')),
        shown: 'Side project',
      },
    ])('adds $name at the end of its section', async (c) => {
      await start();
      await click(buttonNamed($(el, `section.${c.section}`), c.button));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api[c.resource].create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual(c.required);

      for (const [label, value] of Object.entries(c.fill)) type(field(smallForm(), label), value);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api[c.resource].create).toHaveBeenCalledWith(c.body);
      expect(c.visibleAfter()).toBe(c.shown);
    });

    it('closes with Cancel without a request', async () => {
      await start();
      await click(addButton('experience', 'Add experience'));
      type(field(smallForm(), 'Company'), 'Acme');
      await click(buttonNamed(smallForm(), 'Cancel'));

      expect(el.querySelector('form.small-form')).toBeNull();
      expect(api.experiences.create).not.toHaveBeenCalled();
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('stays open with the API error when the item is rejected', async () => {
      api.skills.create.mockReturnValueOnce(badRequest('A skill with this slug already exists'));
      await start();
      await click(addButton('skills', 'Add skill'));
      type(field(smallForm(), 'Name'), 'Angular');
      type(field(smallForm(), 'Category'), 'Core Frameworks');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['A skill with this slug already exists.']);
      expect(field(smallForm(), 'Name').value).toBe('Angular');
    });
  });

  describe('deleting an item', () => {
    it.each([
      ['an experience', 'KX', 'experiences' as const, 'e-kx'],
      ['an education', 'ESIL', 'education' as const, 'ed-esil'],
      ['a project', 'Pierre O11y', 'projects' as const, 'p-site'],
      ['a skill', 'NgRx', 'skills' as const, 's-ngrx'],
    ])('deletes %s once the owner confirms', async (_name, title, resource, id) => {
      await start();
      await click(tool(`Delete "${title}"`));

      expect(window.confirm).toHaveBeenCalledWith(`Delete "${title}"?`);
      expect(api[resource].remove).toHaveBeenCalledTimes(1);
      expect(api[resource].remove).toHaveBeenCalledWith(id);
      expect(hasTool(`Delete "${title}"`)).toBe(false);
    });

    it('keeps the item, and sends nothing, when the owner cancels', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await start();
      await click(tool('Delete "KX"'));

      expect(api.experiences.remove).not.toHaveBeenCalled();
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('keeps the item and shows the API error when the deletion fails', async () => {
      api.experiences.remove.mockReturnValueOnce(badRequest('Cannot delete this experience'));
      await start();
      await click(tool('Delete "KX"'));

      expect(formAlerts()).toEqual(['Cannot delete this experience.']);
      expect(statuses()).toEqual(['Not saved']);
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('takes a deleted skill out of the tech stack shown and of the tech stack form', async () => {
      await start();
      await click(tool('Delete "NgRx"'));
      expect($(job(1), '.stack').textContent).toMatch(/Tech stack:\s*Angular\b/);
      expect($(job(1), '.stack').textContent).not.toContain('NgRx');

      await click(tool('Edit tech stack of "KX"'));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { skillIds: ['s-angular'] });
    });

    it('takes a deleted skill out of the achievements, so the next achievement save no longer sends it', async () => {
      await start();
      await click(tool('Delete "NgRx"'));
      await write(await open(highlight(1, 1), 'Achievement'), 'Nx monorepo.', 'ctrl');

      const sent = api.experiences.update.mock.calls[0][1]['highlights'] as HighlightInput[];
      expect(sent.map((h) => h.skillIds)).toEqual([[], []]);
    });
  });

  describe('moving an item', () => {
    it('moves an item up with every id of the list, and applies it once the server answers', async () => {
      const reply = new Subject<unknown>();
      api.experiences.reorder.mockReturnValueOnce(reply);
      await start();
      await click(tool('Move "KX" up'));

      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz']);
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(statuses()).toEqual(['Saving…']);

      serverReorder('experiences', ['e-kx', 'e-whoz']);
      reply.next(undefined);
      reply.complete();
      await settle();
      expect(companies()).toEqual(['KX', 'Whoz']);
      expect(statuses()).toEqual(['Saved']);
    });

    it('moves an item down', async () => {
      await start();
      await click(tool('Move "Whoz" down'));

      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz']);
      expect(companies()).toEqual(['KX', 'Whoz']);
    });

    it.each([
      ['the first experience cannot go up', 'Move "Whoz" up'],
      ['the last experience cannot go down', 'Move "KX" down'],
      ['a single education cannot go up', 'Move "ESIL" up'],
      ['a single education cannot go down', 'Move "ESIL" down'],
      ['a single project cannot go up', 'Move "Pierre O11y" up'],
      ['a single project cannot go down', 'Move "Pierre O11y" down'],
    ])('%s', async (_name, label) => {
      await start();
      expect(tool(label).disabled).toBe(true);
    });

    it('can move the other experience in both directions', async () => {
      await start();
      expect(tool('Move "Whoz" down').disabled).toBe(false);
      expect(tool('Move "KX" up').disabled).toBe(false);
    });

    describe('skills', () => {
      // Core Frameworks: Angular, RxJS (with other categories between them in the list)
      beforeEach(() => server.lists.skills.push(structuredClone(rxjs) as unknown as Entity));

      it('moves a skill within its category, swapping with the nearest skill of that category', async () => {
        await start();
        await click(tool('Move "RxJS" up'));

        expect(api.skills.reorder).toHaveBeenCalledWith([
          's-rxjs',
          's-ngrx',
          's-jest',
          's-angular',
        ]);
        const core = [...skillsSection().querySelectorAll('dd')][0];
        expect([...core.querySelectorAll('button.inline-text')].map((b) => visible(b))).toEqual([
          'RxJS',
          'Angular',
        ]);
      });

      it.each([
        ['the first of its category cannot go up', 'Move "Angular" up', true],
        ['the last of its category cannot go down', 'Move "RxJS" down', true],
        ['the first of its category can go down', 'Move "Angular" down', false],
        ['the last of its category can go up', 'Move "RxJS" up', false],
        ['a skill alone in its category cannot go up', 'Move "NgRx" up', true],
        ['a skill alone in its category cannot go down', 'Move "NgRx" down', true],
      ])('%s', async (_name, label, disabled) => {
        await start();
        expect(tool(label).disabled).toBe(disabled);
      });
    });
  });
});
