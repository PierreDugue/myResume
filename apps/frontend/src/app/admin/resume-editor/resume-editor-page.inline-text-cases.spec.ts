import { HttpErrorResponse } from '@angular/common/http';
import type { HighlightInput } from '@my-resume/api-models';
import { Subject } from 'rxjs';
import { kx } from '../testing/fixtures';
import { type } from '../testing/render';
import {
  setUpEditorTests,
  Resource,
  adminProfile,
  server,
  serverUpdate,
  api,
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
  tool,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('editing a text in place', () => {
    describe('sends only the edited key, mapped like the section screens', () => {
      const cases: {
        name: string;
        scope: () => ParentNode;
        label: string;
        current: string;
        typed: string;
        how: SaveWith;
        resource: Resource;
        id: string;
        body: object;
      }[] = [
        {
          name: 'trims an experience role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: '  Lead  ',
          how: 'enter',
          resource: 'experiences',
          id: 'e-kx',
          body: { role: 'Lead' },
        },
        {
          name: 'clears an experience location to null',
          scope: () => job(1),
          label: 'Location',
          current: 'Full Remote',
          typed: '',
          how: 'enter',
          resource: 'experiences',
          id: 'e-kx',
          body: { location: null },
        },
        {
          name: 'edits an education degree',
          scope: () => educationArticle(),
          label: 'Degree',
          current: "Diplôme d'ingénieur",
          typed: 'MSc',
          how: 'enter',
          resource: 'education',
          id: 'ed-esil',
          body: { degree: 'MSc' },
        },
        {
          name: 'clears an education field to null',
          scope: () => educationArticle(),
          label: 'Field',
          current: 'Computer Science',
          typed: '',
          how: 'enter',
          resource: 'education',
          id: 'ed-esil',
          body: { field: null },
        },
        {
          name: 'edits a project title',
          scope: () => projectArticle(),
          label: 'Title',
          current: 'Pierre O11y',
          typed: 'Pierre Site',
          how: 'enter',
          resource: 'projects',
          id: 'p-site',
          body: { title: 'Pierre Site' },
        },
        {
          name: 'edits a project description',
          scope: () => projectArticle(),
          label: 'Description',
          current: 'This site.',
          typed: 'The resume as an observability platform.',
          how: 'ctrl',
          resource: 'projects',
          id: 'p-site',
          body: { description: 'The resume as an observability platform.' },
        },
        {
          name: 'renames a skill',
          scope: () => skillsSection(),
          label: 'Name',
          current: 'NgRx',
          typed: 'NgRx Store',
          how: 'enter',
          resource: 'skills',
          id: 's-ngrx',
          body: { name: 'NgRx Store' },
        },
      ];

      it.each(cases)('$name', async ({ scope, label, current, typed, how, resource, id, body }) => {
        await start();
        await write(await open(scope(), label, current), typed, how);

        expect(api[resource].update).toHaveBeenCalledTimes(1);
        expect(api[resource].update).toHaveBeenCalledWith(id, body);
        expect(statuses()).toEqual(['Saved']);
      });
    });

    describe('a highlight', () => {
      it('sends the complete list of achievements, each keeping its id and other details', async () => {
        await start();
        await write(
          await open(highlight(1, 1), 'Achievement'),
          'Introduced an Nx monorepo.',
          'ctrl',
        );

        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          highlights: [
            {
              id: 'h-1',
              date: '2025-11-30',
              level: 'achievement',
              message: 'Cut average page load time by 35%.',
              impact: kx.highlights[0].impact,
              labels: { team: 'platform' },
              skillIds: ['s-ngrx'],
            },
            {
              id: 'h-2',
              date: '2025-11-30',
              level: 'milestone',
              message: 'Introduced an Nx monorepo.',
              impact: null,
              labels: {},
              skillIds: [],
            },
          ],
        });
        expect(visible(inline(highlight(1, 1), 'Achievement'))).toBe('Introduced an Nx monorepo.');
      });

      it('builds each request from the latest saved content, not from what was open before', async () => {
        const firstSave = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(firstSave);
        await start();

        await write(await open(highlight(1, 0), 'Achievement'), 'First, edited', 'ctrl');
        expect(statuses()).toEqual(['Saving…']);

        // the second field is opened while the first save is still pending ...
        const second = await open(highlight(1, 1), 'Achievement');
        type(second, 'Second, edited');
        await settle();
        // ... and the first save is answered before the second one is sent
        const sent = api.experiences.update.mock.calls[0][1];
        firstSave.next(serverUpdate('experiences', 'e-kx', sent));
        firstSave.complete();
        await settle();
        press(second, 'Enter', { ctrlKey: true });
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(2);
        const messages = (
          api.experiences.update.mock.calls[1][1]['highlights'] as HighlightInput[]
        ).map((h) => h.message);
        expect(messages).toEqual(['First, edited', 'Second, edited']);
        expect(visible(inline(highlight(1, 0), 'Achievement'))).toBe('First, edited');
      });
    });

    describe('a profile text', () => {
      it('saves the whole profile, with the hidden phone and its visibility kept', async () => {
        await start();
        await write(await open(header(), 'Headline'), 'Lead Angular Engineer', 'enter');

        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(api.saveProfile).toHaveBeenCalledWith({
          ...adminProfile,
          headline: 'Lead Angular Engineer',
        });
        expect(visible(inline(header(), 'Headline'))).toBe('Lead Angular Engineer');
        expect(statuses()).toEqual(['Saved']);
      });

      it('clears an optional profile text to null', async () => {
        await start();
        await write(await open(header(), 'Location'), '', 'enter');

        expect(api.saveProfile).toHaveBeenCalledWith({ ...adminProfile, location: null });
        expect(visible(inline(header(), 'Location'))).toBe('Add location');
      });

      it('builds the request from the latest saved profile, not from what was open before', async () => {
        const firstSave = new Subject<unknown>();
        api.saveProfile.mockReturnValueOnce(firstSave);
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');

        const summary = await open(header(), 'Summary');
        type(summary, 'New summary');
        await settle();
        const sent = api.saveProfile.mock.calls[0][0];
        server.profile = sent;
        firstSave.next(structuredClone(sent));
        firstSave.complete();
        await settle();
        press(summary, 'Enter', { ctrlKey: true });
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          summary: 'New summary',
        });
      });
    });

    describe('leaving the field for another control', () => {
      const other = () => tool('Edit dates of "KX"');

      it('keeps focus on that control, and sends nothing, when the text is unchanged', async () => {
        await start();
        const input = await open(job(1), 'Role');
        input.focus();
        other().focus();
        await settle();

        expect(api.experiences.update).not.toHaveBeenCalled();
        expect(job(1).querySelector('input, textarea')).toBeNull();
        expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
        expect(document.activeElement).toBe(other());
      });

      it('saves a changed text and keeps focus on that control after "Saved"', async () => {
        await start();
        const input = await open(job(1), 'Role');
        type(input, 'Lead Engineer');
        await settle();
        input.focus();
        other().focus();
        await settle();

        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
        expect(statuses()).toEqual(['Saved']);
        expect(visible(inline(job(1), 'Role'))).toBe('Lead Engineer');
        expect(document.activeElement).toBe(other());
      });
    });

    describe('Escape while the save is pending', () => {
      it('leaves the field open, still saving, and still shows a later failure', async () => {
        const pending = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(pending);
        await start();
        const input = await open(job(1), 'Role');
        await write(input, 'Too much', 'enter');
        expect(statuses()).toEqual(['Saving…']);

        press(input, 'Escape');
        await settle();
        expect(job(1).contains(input)).toBe(true);
        expect(fieldIn(job(1), 'Role').value).toBe('Too much');
        expect(statuses()).toEqual(['Saving…']);

        pending.error(
          new HttpErrorResponse({
            status: 400,
            error: { message: ['role must be shorter than or equal to 120 characters'] },
          }),
        );
        await settle();
        expect(fieldIn(job(1), 'Role').value).toBe('Too much');
        expect(fieldErrors()).toEqual(['role must be shorter than or equal to 120 characters.']);
        expect(statuses()).toEqual(['Not saved']);
      });
    });

    describe('Enter while an input method is composing', () => {
      it.each<[string, string, KeyboardEventInit]>([
        ['an input', 'Role', {}],
        ['a text area, with Ctrl', 'Summary', { ctrlKey: true }],
      ])('does not save %s, and saves with the next Enter', async (_name, label, keys) => {
        await start();
        const input = await open(job(1), label);
        type(input, 'あいう');
        await settle();

        press(input, 'Enter', { ...keys, isComposing: true });
        await settle();
        expect(api.experiences.update).not.toHaveBeenCalled();
        expect(job(1).contains(input)).toBe(true);
        expect(statuses()).toEqual([]);

        press(input, 'Enter', keys);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(statuses()).toEqual(['Saved']);
      });

      /** Safari: the Enter that commits a composition has `isComposing: false` and keyCode 229. */
      const safariCommit = (keys: KeyboardEventInit) => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          keyCode: 229,
          bubbles: true,
          cancelable: true,
          ...keys,
        });
        if (event.keyCode !== 229) Object.defineProperty(event, 'keyCode', { value: 229 });
        return event;
      };

      it.each<[string, string, KeyboardEventInit]>([
        ['an input', 'Role', {}],
        ['a text area, with Ctrl', 'Summary', { ctrlKey: true }],
      ])(
        'does not save %s on the Enter that commits a composition in Safari (keyCode 229)',
        async (_name, label, keys) => {
          await start();
          const input = await open(job(1), label);
          type(input, 'あいう');
          await settle();

          input.dispatchEvent(safariCommit(keys));
          await settle();
          expect(api.experiences.update).not.toHaveBeenCalled();
          expect(job(1).contains(input)).toBe(true);
          expect(statuses()).toEqual([]);

          press(input, 'Enter', keys);
          await settle();
          expect(api.experiences.update).toHaveBeenCalledTimes(1);
          expect(statuses()).toEqual(['Saved']);
        },
      );
    });
  });
});
