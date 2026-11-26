import { Subject } from 'rxjs';

import { type } from '../testing/render';
import {
  setUpEditorTests,
  serverUpdate,
  api,
  badRequest,
  settle,
  start,
  visible,
  inline,
  fieldIn,
  open,
  press,
  SaveWith,
  write,
  statuses,
  fieldErrors,
  header,
  job,
  projectArticle,
  educationArticle,
  skillsSection,
  highlight,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('editing a text in place', () => {
    it('opens a field with the text, focused, and saves it with Enter as a PATCH of that key only', async () => {
      await start();
      const input = await open(job(1), 'Role');
      expect(input.tagName).toBe('INPUT');
      expect(input.value).toBe('Angular Front-End Engineer');
      expect(document.activeElement).toBe(input);

      await write(input, 'Lead Engineer', 'enter');

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
      expect(statuses()).toEqual(['Saved']);
      expect(job(1).querySelector('input, textarea')).toBeNull();
      const text = inline(job(1), 'Role');
      expect(visible(text)).toBe('Lead Engineer');
      expect(document.activeElement).toBe(text);
      expect(visible(inline(job(0), 'Role'))).toBe('Angular Front-End Engineer');
    });

    it('cancels with Escape: no request, the old text back, focus on the text button', async () => {
      await start();
      const input = await open(job(1), 'Role');
      type(input, 'Changed my mind');
      press(input, 'Escape');
      await settle();

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).querySelector('input, textarea')).toBeNull();
      const text = inline(job(1), 'Role');
      expect(visible(text)).toBe('Angular Front-End Engineer');
      expect(document.activeElement).toBe(text);

      // the abandoned text is not remembered
      expect((await open(job(1), 'Role')).value).toBe('Angular Front-End Engineer');
    });

    it('saves when the field loses focus', async () => {
      await start();
      await write(await open(job(1), 'Role'), 'Principal Engineer', 'blur');

      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Principal Engineer' });
      expect(visible(inline(job(1), 'Role'))).toBe('Principal Engineer');
    });

    it.each<[string, SaveWith]>([
      ['Enter', 'enter'],
      ['blur', 'blur'],
    ])('sends nothing and just closes when %s leaves the text unchanged', async (_name, how) => {
      await start();
      const input = await open(job(1), 'Role');
      await write(input, 'Angular Front-End Engineer', how);

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).querySelector('input, textarea')).toBeNull();
      expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
    });

    it('edits a long text in a text area where Enter adds a line instead of saving', async () => {
      await start();
      const area = await open(job(1), 'Summary');
      expect(area.tagName).toBe('TEXTAREA');
      type(area, 'Line one\nLine two');
      press(area, 'Enter');
      await settle();

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).contains(area)).toBe(true);
    });

    it.each<[string, SaveWith]>([
      ['Ctrl+Enter', 'ctrl'],
      ['Cmd+Enter', 'meta'],
    ])('saves a text area with %s, keeping its line breaks', async (_name, how) => {
      await start();
      await write(await open(job(1), 'Summary'), 'Line one\nLine two', how);

      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
        summary: 'Line one\nLine two',
      });
      expect(statuses()).toEqual(['Saved']);
    });

    it('fills an empty optional text, which shows an "Add" prompt', async () => {
      await start();
      const input = await open(job(0), 'Summary');
      expect(input.value).toBe('');
      await write(input, 'Building a skills platform.', 'ctrl');

      expect(api.experiences.update).toHaveBeenCalledWith('e-whoz', {
        summary: 'Building a skills platform.',
      });
      expect(visible(inline(job(0), 'Summary'))).toBe('Building a skills platform.');
    });

    it('shows "Saving…" while the request is pending, then "Saved"', async () => {
      const pending = new Subject<unknown>();
      api.experiences.update.mockReturnValueOnce(pending);
      await start();
      await write(await open(job(1), 'Role'), 'Lead', 'enter');
      expect(statuses()).toEqual(['Saving…']);

      pending.next(serverUpdate('experiences', 'e-kx', { role: 'Lead' }));
      pending.complete();
      await settle();
      expect(statuses()).toEqual(['Saved']);
      expect(visible(inline(job(1), 'Role'))).toBe('Lead');
    });

    it('shows the API error under the field, keeps what was typed, and saves once corrected', async () => {
      api.experiences.update.mockReturnValueOnce(
        badRequest('role must be shorter than or equal to 120 characters'),
      );
      await start();
      const input = await open(job(1), 'Role');
      await write(input, 'Too much', 'enter');

      expect(fieldErrors()).toEqual(['role must be shorter than or equal to 120 characters.']);
      expect(statuses()).toEqual(['Not saved']);
      expect(fieldIn(job(1), 'Role').value).toBe('Too much');

      await write(fieldIn(job(1), 'Role'), 'Fine', 'enter');
      expect(api.experiences.update).toHaveBeenLastCalledWith('e-kx', { role: 'Fine' });
      expect(fieldErrors()).toEqual([]);
      expect(statuses()).toEqual(['Saved']);
    });

    describe('with the rules of the section screens', () => {
      const cases: {
        name: string;
        scope: () => ParentNode;
        label: string;
        current: string;
        typed: string;
        how: SaveWith;
        message: string;
      }[] = [
        {
          name: 'a role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: '',
          how: 'enter',
          message: 'Role is required',
        },
        {
          name: 'a 121-character role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: 'x'.repeat(121),
          how: 'enter',
          message: 'Use at most 120 characters',
        },
        {
          name: 'a company',
          scope: () => job(1),
          label: 'Company',
          current: 'KX',
          typed: '',
          how: 'enter',
          message: 'Company is required',
        },
        {
          name: 'an achievement',
          scope: () => highlight(1, 1),
          label: 'Achievement',
          current: 'Introduced an NX monorepo.',
          typed: '',
          how: 'ctrl',
          message: 'Describe the achievement',
        },
        {
          name: 'a school',
          scope: () => educationArticle(),
          label: 'School',
          current: 'ESIL',
          typed: '',
          how: 'enter',
          message: 'School is required',
        },
        {
          name: 'a degree',
          scope: () => educationArticle(),
          label: 'Degree',
          current: "Diplôme d'ingénieur",
          typed: '',
          how: 'enter',
          message: 'Degree is required',
        },
        {
          name: 'a project title',
          scope: () => projectArticle(),
          label: 'Title',
          current: 'Pierre O11y',
          typed: '',
          how: 'enter',
          message: 'Title is required',
        },
        {
          name: 'a project description',
          scope: () => projectArticle(),
          label: 'Description',
          current: 'This site.',
          typed: '',
          how: 'ctrl',
          message: 'Description is required',
        },
        {
          name: 'a skill name',
          scope: () => skillsSection(),
          label: 'Name',
          current: 'NgRx',
          typed: '',
          how: 'enter',
          message: 'Name is required',
        },
        {
          name: 'a full name',
          scope: () => header(),
          label: 'Full name',
          current: 'Pierre Dugue',
          typed: '',
          how: 'enter',
          message: 'Full name is required',
        },
        {
          name: 'an email address',
          scope: () => header(),
          label: 'Email',
          current: 'pierre@example.com',
          typed: 'not-an-email',
          how: 'enter',
          message: 'Enter a valid email address',
        },
        {
          name: 'a profile summary',
          scope: () => header(),
          label: 'Summary',
          current: 'Senior Angular developer.',
          typed: '',
          how: 'ctrl',
          message: 'Summary is required',
        },
      ];

      it.each(cases)(
        'refuses $name without sending anything, keeping the typed value',
        async ({ scope, label, current, typed, how, message }) => {
          await start();
          const input = await open(scope(), label, current);
          await write(input, typed, how);

          for (const call of [
            api.experiences.update,
            api.education.update,
            api.projects.update,
            api.skills.update,
            api.saveProfile,
          ]) {
            expect(call).not.toHaveBeenCalled();
          }
          expect(fieldErrors()).toEqual([message]);
          expect(statuses()).toEqual(['Not saved']);
          expect(fieldIn(scope(), label).value).toBe(typed);
        },
      );
    });
  });
});
