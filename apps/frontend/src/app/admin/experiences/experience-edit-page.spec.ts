import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { kx, skills, whoz } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { ExperienceEditPage } from './experience-edit-page';

@Component({ template: 'list' })
class List {}

describe('ExperienceEditPage', () => {
  const experiences = {
    list: vi.fn(() => of([whoz, kx])),
    create: vi.fn((b: object) => of({ id: 'new', ...b })),
    update: vi.fn((id: string, b: object) => of({ id, ...b })),
  };
  const api = { experiences, skills: { list: vi.fn(() => of(skills)) } };
  const render = (url: string) =>
    renderRoute(
      url,
      [
        { path: 'admin/experiences', component: List },
        { path: 'admin/experiences/:id', component: ExperienceEditPage },
      ],
      [{ provide: ContentApi, useValue: api }],
    );
  const submit = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();

  beforeEach(() => Object.values(experiences).forEach((fn) => fn.mockClear()));

  it('loads an experience with its skills and highlights', async () => {
    const { el } = await render('/admin/experiences/e-kx');
    expect(field(el, 'Company').value).toBe('KX');
    expect(field(el, 'Start date').value).toBe('2022-09-01');
    expect(field(el, 'End date').value).toBe('2025-11-30');
    expect(
      (el.querySelector('input[type="checkbox"][value="s-ngrx"]') as HTMLInputElement).checked,
    ).toBe(true);
    expect(field(el, 'Achievement 1').value).toBe('Cut average page load time by 35%.');
    expect(field(el, 'Achievement 1 impact metric').value).toBe('Page load time');
  });

  it('saves the full payload: ordered highlights keep their ids, empty end date means current', async () => {
    const { el, settle, router } = await render('/admin/experiences/e-kx');
    type(field(el, 'End date'), '');
    $<HTMLButtonElement>(el, 'button[aria-label="Move achievement 2 up"]').click();
    await settle();
    submit(el);
    await settle();

    const [id, body] = experiences.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('e-kx');
    expect(body).toMatchObject({ company: 'KX', endDate: null, skillIds: ['s-angular', 's-ngrx'] });
    expect((body['highlights'] as { id?: string }[]).map((h) => h.id)).toEqual(['h-2', 'h-1']);
    expect((body['highlights'] as { impact: unknown }[])[1].impact).toEqual(
      kx.highlights[0].impact,
    );
    expect(router.url).toBe('/admin/experiences');
  });

  it('creates an experience with a new achievement', async () => {
    const { el, settle } = await render('/admin/experiences/new');
    type(field(el, 'Company'), 'Acme');
    type(field(el, 'Role'), 'Engineer');
    type(field(el, 'Start date'), '2027-01-01');
    $<HTMLButtonElement>(el, 'button.add-highlight').click();
    await settle();
    type(field(el, 'Achievement 1'), 'Shipped the thing.');
    type(field(el, 'Achievement 1 date'), '2027-06-30');
    submit(el);
    await settle();

    expect(experiences.create).toHaveBeenCalledWith({
      company: 'Acme',
      role: 'Engineer',
      location: null,
      startDate: '2027-01-01',
      endDate: null,
      summary: null,
      skillIds: [],
      highlights: [
        { date: '2027-06-30', level: 'info', message: 'Shipped the thing.', impact: null },
      ],
    });
  });

  it('removes an achievement', async () => {
    const { el, settle } = await render('/admin/experiences/e-kx');
    $<HTMLButtonElement>(el, 'button[aria-label="Remove achievement 1"]').click();
    await settle();
    submit(el);
    await settle();
    const body = experiences.update.mock.calls[0][1] as { highlights: { id?: string }[] };
    expect(body.highlights.map((h) => h.id)).toEqual(['h-2']);
  });

  it('refuses an end date before the start date', async () => {
    const { el, settle } = await render('/admin/experiences/e-kx');
    type(field(el, 'End date'), '2020-01-01');
    submit(el);
    await settle();
    expect(experiences.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('The end date must be after the start date');
  });

  it('requires a metric name when an achievement has a measurable impact', async () => {
    const { el, settle } = await render('/admin/experiences/e-kx');
    type(field(el, 'Achievement 1 impact metric'), '  ');
    submit(el);
    await settle();
    expect(experiences.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Name the metric of this impact');
  });

  it('requires a message and a date for a new achievement', async () => {
    const { el, settle } = await render('/admin/experiences/e-kx');
    $<HTMLButtonElement>(el, 'button.add-highlight').click();
    await settle();
    submit(el);
    await settle();
    expect(experiences.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Describe the achievement');
    expect(el.textContent).toContain('Date is required');
  });

  it('shows the API error when saving fails', async () => {
    experiences.update.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'Unknown skill ids' } }),
      ),
    );
    const { el, settle } = await render('/admin/experiences/e-kx');
    submit(el);
    await settle();
    expect($(el, '[role="alert"]').textContent).toContain('Unknown skill ids.');
  });
});
