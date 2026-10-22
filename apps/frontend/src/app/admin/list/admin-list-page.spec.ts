import { Component } from '@angular/core';
import type { Experience } from '@my-resume/api-models';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { kx, whoz } from '../testing/fixtures';
import { renderRoute } from '../testing/render';
import { AdminListPage, ListConfig } from './admin-list-page';

@Component({ template: 'edit page' })
class Edit {}

describe('AdminListPage', () => {
  let items: Experience[];
  const resource = {
    list: vi.fn(() => of(items)),
    reorder: vi.fn(() => of(undefined)),
    remove: vi.fn(() => of(undefined)),
  };
  const config: ListConfig<Experience> = {
    resource: 'experiences',
    label: 'Experiences',
    addLabel: 'Add experience',
    toItem: (e) => ({ id: e.id, title: e.company, subtitle: e.role }),
  };

  const render = () =>
    renderRoute(
      '/admin/experiences',
      [
        { path: 'admin/experiences', component: AdminListPage, data: { list: config } },
        { path: 'admin/experiences/:id', component: Edit },
      ],
      [{ provide: ContentApi, useValue: { experiences: resource } }],
    );

  beforeEach(() => {
    items = [whoz, kx];
    Object.values(resource).forEach((fn) => fn.mockClear());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists the items, each linking to its edit page', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll<HTMLAnchorElement>('li a.title')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Whoz', 'KX']);
    expect(links[1].getAttribute('href')).toBe('/admin/experiences/e-kx');
  });

  it('links to the creation page', async () => {
    const { el } = await render();
    const add = $<HTMLAnchorElement>(el, 'a.add');
    expect(add.textContent?.trim()).toBe('Add experience');
    expect(add.getAttribute('href')).toBe('/admin/experiences/new');
  });

  it('saves a new order, then reloads the list', async () => {
    const { el, settle } = await render();
    items = [kx, whoz];
    $<HTMLButtonElement>(el, 'li:nth-child(2) button.move-up').click();
    await settle();
    expect(resource.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz']);
    expect([...el.querySelectorAll('li a.title')].map((a) => a.textContent?.trim())).toEqual([
      'KX',
      'Whoz',
    ]);
  });

  it('deletes an item after confirmation, then reloads the list', async () => {
    const { el, settle } = await render();
    items = [whoz];
    $<HTMLButtonElement>(el, 'li:nth-child(2) button.delete').click();
    await settle();
    expect(resource.remove).toHaveBeenCalledWith('e-kx');
    expect(el.querySelectorAll('li')).toHaveLength(1);
  });

  it('shows the API error when an action fails', async () => {
    resource.remove.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({ status: 404, error: { message: 'Experience e-kx not found' } }),
      ),
    );
    const { el, settle } = await render();
    $<HTMLButtonElement>(el, 'li:nth-child(2) button.delete').click();
    await settle();
    expect($(el, '[role="alert"]').textContent).toContain('Experience e-kx not found.');
  });
});
