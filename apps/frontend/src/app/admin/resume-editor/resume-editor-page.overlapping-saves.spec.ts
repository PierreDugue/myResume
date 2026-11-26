import { HttpErrorResponse } from '@angular/common/http';
import type { HighlightInput } from '@my-resume/api-models';
import { Subject } from 'rxjs';
import { $ } from '../../testing';
import { kx } from '../testing/fixtures';
import { field, type } from '../testing/render';
import {
  setUpEditorTests,
  Entity,
  adminProfile,
  server,
  serverUpdate,
  serverReorder,
  api,
  el,
  settle,
  isAuthenticated,
  start,
  visible,
  inline,
  fieldIn,
  open,
  press,
  write,
  startWithAdminRoute,
  statuses,
  fieldErrors,
  formAlerts,
  header,
  job,
  companies,
  highlight,
  tool,
  smallForm,
  buttonNamed,
  click,
} from './testing/editor-harness';

describe('ResumeEditorPage', () => {
  setUpEditorTests();

  describe('overlapping saves', () => {
    /** Starts the next profile PUT as a pending request the test answers itself. */
    const holdProfileSave = () => {
      const pending = new Subject<unknown>();
      api.saveProfile.mockReturnValueOnce(pending);
      return pending;
    };
    /** The server accepts the PUT the page sent and answers it. */
    const answerProfileSave = (pending: Subject<unknown>, call: number) => {
      const sent = api.saveProfile.mock.calls[call][0];
      server.profile = structuredClone(sent);
      pending.next(structuredClone(sent));
      pending.complete();
    };
    const statusOf = (node: Element) =>
      node.closest('app-inline-text')?.querySelector('span.save-status')?.textContent?.trim();

    it('sends a second profile text only after the first answer, with both changes', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');
      await write(await open(header(), 'Location'), 'Paris, France', 'enter');

      expect(api.saveProfile).toHaveBeenCalledTimes(1);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      answerProfileSave(first, 0);
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        headline: 'New headline',
        location: 'Paris, France',
      });
      expect(visible(inline(header(), 'Headline'))).toBe('New headline');
      expect(visible(inline(header(), 'Location'))).toBe('Paris, France');
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('sends the second achievement of an experience with the first one already in', async () => {
      const first = new Subject<unknown>();
      api.experiences.update.mockReturnValueOnce(first);
      await start();
      await write(await open(highlight(1, 0), 'Achievement'), 'First, edited', 'ctrl');
      await write(await open(highlight(1, 1), 'Achievement'), 'Second, edited', 'ctrl');

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      first.next(serverUpdate('experiences', 'e-kx', api.experiences.update.mock.calls[0][1]));
      first.complete();
      await settle();

      expect(api.experiences.update).toHaveBeenCalledTimes(2);
      const sent = api.experiences.update.mock.calls[1][1]['highlights'] as HighlightInput[];
      expect(sent.map((h) => h.message)).toEqual(['First, edited', 'Second, edited']);
      expect(sent.map((h) => h.id)).toEqual(['h-1', 'h-2']);
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('sends the links with a profile text saved just before', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');

      await click(tool('Edit links'));
      await click(buttonNamed(smallForm(), 'Add link'));
      type(field(smallForm(), 'Link 2 label'), 'GitHub');
      type(field(smallForm(), 'Link 2 URL'), 'https://github.com/example');
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.saveProfile).toHaveBeenCalledTimes(1);

      answerProfileSave(first, 0);
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        headline: 'New headline',
        links: [...adminProfile.links, { label: 'GitHub', url: 'https://github.com/example' }],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(visible(inline(header(), 'Headline'))).toBe('New headline');
    });

    it('runs a write of another kind of item after the pending write too', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');
      await write(await open(job(1), 'Role'), 'Lead Engineer', 'enter');

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      answerProfileSave(first, 0);
      await settle();

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('moves two items of one list one after the other, the second from the new order', async () => {
      server.lists.experiences.push({
        ...structuredClone(kx),
        id: 'e-third',
        company: 'Third',
        sortOrder: 2,
        highlights: [],
      } as unknown as Entity);
      const first = new Subject<unknown>();
      api.experiences.reorder.mockReturnValueOnce(first);
      await start();
      expect(companies()).toEqual(['Whoz', 'KX', 'Third']);

      await click(tool('Move "Whoz" down'));
      await click(tool('Move "Third" up'));
      expect(api.experiences.reorder).toHaveBeenCalledTimes(1);
      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz', 'e-third']);
      expect(companies()).toEqual(['Whoz', 'KX', 'Third']);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      serverReorder('experiences', ['e-kx', 'e-whoz', 'e-third']);
      first.next(undefined);
      first.complete();
      await settle();

      expect(api.experiences.reorder).toHaveBeenCalledTimes(2);
      expect(api.experiences.reorder).toHaveBeenLastCalledWith(['e-kx', 'e-third', 'e-whoz']);
      expect(companies()).toEqual(['KX', 'Third', 'Whoz']);
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('still sends a queued write when the one before it fails, from the unchanged state', async () => {
      const first = holdProfileSave();
      await start();
      const headline = await open(header(), 'Headline');
      await write(headline, 'Too much', 'enter');
      await write(await open(header(), 'Location'), 'Paris, France', 'enter');
      expect(api.saveProfile).toHaveBeenCalledTimes(1);

      first.error(
        new HttpErrorResponse({
          status: 400,
          error: { message: ['headline must be shorter than or equal to 160 characters'] },
        }),
      );
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        location: 'Paris, France',
      });
      expect(statusOf(fieldIn(header(), 'Headline'))).toBe('Not saved');
      expect(fieldIn(header(), 'Headline').value).toBe('Too much');
      expect(fieldErrors()).toEqual(['headline must be shorter than or equal to 160 characters.']);
      expect(statusOf(inline(header(), 'Location'))).toBe('Saved');
      expect(visible(inline(header(), 'Location'))).toBe('Paris, France');
      press(fieldIn(header(), 'Headline'), 'Escape');
      await settle();
      expect(visible(inline(header(), 'Headline'))).toBe(
        'Senior Front-End Engineer | Angular Specialist',
      );
    });

    describe('text typed while its save is pending', () => {
      it('saves the newer text of a profile field once the pending saves are in', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        const location = await open(header(), 'Location');
        await write(location, 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(statuses()).toEqual(['Saving…', 'Saving…']);

        await write(location, 'Paris, France (remote)', 'blur');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(3);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          location: 'Paris, France (remote)',
        });
        expect(el.querySelector('input, textarea')).toBeNull();
        expect(visible(inline(header(), 'Headline'))).toBe('New headline');
        expect(visible(inline(header(), 'Location'))).toBe('Paris, France (remote)');
        expect(statuses()).toEqual(['Saved', 'Saved']);
      });

      it('saves the newer text of an item field with a second PATCH of that key only', async () => {
        const pending = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(pending);
        await start();
        const role = await open(job(1), 'Role');
        await write(role, 'Lead', 'enter');
        expect(statuses()).toEqual(['Saving…']);

        type(role, 'Lead Engineer');
        await settle();
        pending.next(serverUpdate('experiences', 'e-kx', { role: 'Lead' }));
        pending.complete();
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(2);
        expect(api.experiences.update).toHaveBeenLastCalledWith('e-kx', { role: 'Lead Engineer' });
        expect(job(1).querySelector('input, textarea')).toBeNull();
        expect(visible(inline(job(1), 'Role'))).toBe('Lead Engineer');
        expect(statuses()).toEqual(['Saved']);
      });
    });

    describe('small forms while their write is pending', () => {
      const disabledControls = (selector: string) =>
        [...smallForm().querySelectorAll<HTMLElement>(selector)].map((c) => c.matches(':disabled'));

      it('makes the dates form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit dates of "KX"'));
        type(field(smallForm(), 'End date'), '2024-01-01');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        expect(disabledControls('input')).toEqual([true, true]);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          startDate: '2022-09-01',
          endDate: '2024-01-01',
        });
        expect(el.querySelector('form.small-form')).toBeNull();
      });

      it('makes the links form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit links'));
        type(field(smallForm(), 'Link 1 label'), 'LinkedIn profile');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        expect(disabledControls('input')).toEqual([true, true]);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(el.querySelector('form.small-form')).toBeNull();
      });

      it('makes the tech stack form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit tech stack of "KX"'));
        await click($(smallForm(), 'input[type="checkbox"][value="s-jest"]'));
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        const boxes = disabledControls('input[type="checkbox"]');
        expect(boxes.length).toBeGreaterThan(0);
        expect(boxes.every(Boolean)).toBe(true);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          skillIds: ['s-angular', 's-ngrx', 's-jest'],
        });
        expect(el.querySelector('form.small-form')).toBeNull();
      });
    });

    describe('when the control that started a write is gone', () => {
      it('still sends the queued writes, in order and with both changes, after leaving the page', async () => {
        const first = holdProfileSave();
        const { router } = await startWithAdminRoute();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await write(await open(header(), 'Location'), 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        await router.navigateByUrl('/admin');
        await settle();
        expect(el.textContent).toContain('admin home');
        expect(el.querySelector('header.resume-header')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          location: 'Paris, France',
        });
        expect(server.profile).toMatchObject({
          headline: 'New headline',
          location: 'Paris, France',
        });
      });

      // The "Dates" button closes the form while its write waits: that destroys the DatesForm
      // that holds the pending write (Cancel does the same).
      it('still sends the dates of a form closed while its write is queued, with no error', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        const toggle = tool('Edit dates of "KX"');
        await click(toggle);
        type(field(smallForm(), 'End date'), '2024-01-01');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        await click(toggle);
        expect(el.querySelector('form.small-form')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          startDate: '2022-09-01',
          endDate: '2024-01-01',
        });
        expect($(job(1), '.meta').textContent).toContain('Sep 2022 – Jan 2024');
        expect(formAlerts()).toEqual([]);
        expect(el.querySelector('.form-error')).toBeNull();
      });
    });

    // The converse (the queued write IS sent while the session lasts) is the test above,
    // "still sends the queued writes ... after leaving the page".
    describe('when the owner signs out while a write is queued', () => {
      it('does not send the queued write once the session has ended, even after leaving the page', async () => {
        const first = holdProfileSave();
        const { router } = await startWithAdminRoute();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await write(await open(header(), 'Location'), 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        isAuthenticated.set(false);
        await router.navigateByUrl('/admin');
        await settle();
        expect(el.querySelector('header.resume-header')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(server.profile).toMatchObject({ headline: 'New headline' });
        expect(server.profile).not.toMatchObject({ location: 'Paris, France' });
      });
    });
  });
});
