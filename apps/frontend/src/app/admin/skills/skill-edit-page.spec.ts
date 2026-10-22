import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { skills } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { SkillEditPage } from './skill-edit-page';

@Component({ template: 'list' })
class List {}

describe('SkillEditPage', () => {
  const resource = {
    list: vi.fn(() => of(skills)),
    create: vi.fn((b: object) => of({ id: 'new-id', ...b })),
    update: vi.fn((id: string, b: object) => of({ id, ...b })),
  };
  const render = (url: string) =>
    renderRoute(
      url,
      [
        { path: 'admin/skills', component: List },
        { path: 'admin/skills/:id', component: SkillEditPage },
      ],
      [{ provide: ContentApi, useValue: { skills: resource } }],
    );

  beforeEach(() => Object.values(resource).forEach((fn) => fn.mockClear()));

  it('creates a skill and goes back to the list', async () => {
    const { el, settle, router } = await render('/admin/skills/new');
    type(field(el, 'Name'), 'Vitest');
    type(field(el, 'Category'), 'Testing & Tools');
    type(field(el, 'Level'), '4');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.create).toHaveBeenCalledWith({
      name: 'Vitest',
      category: 'Testing & Tools',
      level: 4,
    });
    expect(router.url).toBe('/admin/skills');
  });

  it('suggests the existing categories', async () => {
    const { el } = await render('/admin/skills/new');
    const options = [...el.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'));
    expect(options).toEqual(['Core Frameworks', 'State & Reactive', 'Testing & Tools']);
  });

  it('edits an existing skill; "No level" saves null', async () => {
    const { el, settle } = await render('/admin/skills/s-angular');
    expect(field(el, 'Name').value).toBe('Angular');
    type(field(el, 'Level'), '');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.update).toHaveBeenCalledWith('s-angular', {
      name: 'Angular',
      category: 'Core Frameworks',
      level: null,
    });
  });

  it('disables the save button while saving and shows the API error', async () => {
    const pending = new Subject<never>();
    resource.update.mockReturnValueOnce(pending);
    const { el, settle } = await render('/admin/skills/s-angular');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(true);
    pending.error(new HttpErrorResponse({ status: 409, error: { message: 'Name taken' } }));
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(false);
    expect($(el, '[role="alert"]').textContent).toContain('Name taken');
  });

  it('says so when the skill does not exist', async () => {
    const { el } = await render('/admin/skills/unknown');
    expect($(el, '[role="alert"]').textContent).toContain('not found');
  });

  it('requires a name and a category', async () => {
    const { el, settle } = await render('/admin/skills/new');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Name is required');
    expect(el.textContent).toContain('Category is required');
  });
});
