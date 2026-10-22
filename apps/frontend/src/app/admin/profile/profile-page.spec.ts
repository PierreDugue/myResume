import { HttpErrorResponse } from '@angular/common/http';
import type { Profile } from '@my-resume/api-models';
import { of, Subject, throwError } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { profile } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  let current: Profile | null;
  const api = {
    profile: vi.fn(() => of(current)),
    saveProfile: vi.fn((p: Profile) => of(p)),
  };
  const render = () =>
    renderRoute(
      '/admin/profile',
      [{ path: 'admin/profile', component: ProfilePage }],
      [{ provide: ContentApi, useValue: api }],
    );
  const submit = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();

  beforeEach(() => {
    current = structuredClone(profile);
    api.saveProfile.mockClear();
  });

  it('fills the form with the current profile', async () => {
    const { el } = await render();
    expect(field(el, 'Full name').value).toBe('Pierre Dugue');
    expect(field(el, 'Email').value).toBe('pierre@example.com');
    expect(field(el, 'Years in IT').value).toBe('14');
    expect(field(el, 'Open to relocation').checked).toBe(true);
    expect(field(el, 'Show phone on the site').checked).toBe(false);
    expect(field(el, 'Link 1 label').value).toBe('LinkedIn');
  });

  it('saves the whole profile (numbers as numbers, empty optional text as null)', async () => {
    const { el, settle } = await render();
    type(field(el, 'Headline'), 'Lead Angular Engineer');
    type(field(el, 'Phone'), '');
    type(field(el, 'Years of Angular'), '10');
    submit(el);
    await settle();

    expect(api.saveProfile).toHaveBeenCalledWith({
      ...profile,
      headline: 'Lead Angular Engineer',
      phone: null,
      yearsOfAngular: 10,
    });
    expect($(el, '[role="status"]').textContent).toContain('Saved');
  });

  it('adds and removes links', async () => {
    const { el, settle } = await render();
    $<HTMLButtonElement>(el, 'button.add-link').click();
    await settle();
    type(field(el, 'Link 2 label'), 'GitHub');
    type(field(el, 'Link 2 URL'), 'https://github.com/example');
    $<HTMLButtonElement>(el, 'button[aria-label="Remove link 1"]').click();
    await settle();
    submit(el);
    await settle();
    expect(api.saveProfile.mock.calls[0][0].links).toEqual([
      { label: 'GitHub', url: 'https://github.com/example' },
    ]);
  });

  it('starts from an empty form when there is no profile yet', async () => {
    current = null;
    const { el } = await render();
    expect(field(el, 'Full name').value).toBe('');
  });

  it('blocks saving and shows field errors when required fields are invalid', async () => {
    const { el, settle } = await render();
    type(field(el, 'Full name'), '');
    type(field(el, 'Email'), 'nope');
    submit(el);
    await settle();
    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Full name is required');
    expect(el.textContent).toContain('Enter a valid email address');
  });

  it('refuses a link that is not an http(s) URL', async () => {
    const { el, settle } = await render();
    type(field(el, 'Link 1 URL'), 'javascript:alert(1)');
    submit(el);
    await settle();
    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a URL starting with http:// or https://');
  });

  it('disables the save button while saving', async () => {
    const pending = new Subject<Profile>();
    api.saveProfile.mockReturnValueOnce(pending);
    const { el, settle } = await render();
    submit(el);
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(true);
    pending.next(profile);
    pending.complete();
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(false);
  });

  it('shows the API error when saving fails', async () => {
    api.saveProfile.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: ['links.0.url must be a URL address'] },
          }),
      ),
    );
    const { el, settle } = await render();
    submit(el);
    await settle();
    expect($(el, '[role="alert"]').textContent).toContain('links.0.url must be a URL address.');
  });
});
