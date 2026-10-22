import { Component } from '@angular/core';
import { of } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { esil } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { EducationEditPage } from './education-edit-page';

@Component({ template: 'list' })
class List {}

describe('EducationEditPage', () => {
  const resource = {
    list: vi.fn(() => of([esil])),
    create: vi.fn((b: object) => of({ id: 'new', ...b })),
    update: vi.fn((id: string, b: object) => of({ id, ...b })),
  };
  const render = (url: string) =>
    renderRoute(
      url,
      [
        { path: 'admin/education', component: List },
        { path: 'admin/education/:id', component: EducationEditPage },
      ],
      [{ provide: ContentApi, useValue: { education: resource } }],
    );

  beforeEach(() => Object.values(resource).forEach((fn) => fn.mockClear()));

  it('edits an entry', async () => {
    const { el, settle, router } = await render('/admin/education/ed-esil');
    expect(field(el, 'School').value).toBe('ESIL');
    type(field(el, 'Description'), 'Engineering school.');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.update).toHaveBeenCalledWith('ed-esil', {
      school: 'ESIL',
      degree: "Diplôme d'ingénieur",
      field: 'Computer Science',
      location: 'Marseille, France',
      startDate: '2008-09-01',
      endDate: '2011-06-30',
      description: 'Engineering school.',
    });
    expect(router.url).toBe('/admin/education');
  });

  it('refuses an end date before the start date', async () => {
    const { el, settle } = await render('/admin/education/ed-esil');
    type(field(el, 'End date'), '2000-01-01');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('The end date must be after the start date');
  });

  it('creates an entry and requires school, degree and start date', async () => {
    const { el, settle } = await render('/admin/education/new');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('School is required');

    type(field(el, 'School'), 'IUT R&T');
    type(field(el, 'Degree'), 'DUT');
    type(field(el, 'Start date'), '2005-09-01');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(resource.create).toHaveBeenCalledWith(
      expect.objectContaining({ school: 'IUT R&T', degree: 'DUT', field: null, endDate: null }),
    );
  });
});
