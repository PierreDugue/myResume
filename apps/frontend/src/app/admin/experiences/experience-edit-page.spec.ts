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
        {
          date: '2027-06-30',
          level: 'info',
          message: 'Shipped the thing.',
          impact: null,
          labels: {},
          skillIds: [],
        },
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

  describe('achievement tech and labels', () => {
    /** The technology checkboxes of achievement `n`, by skill name. */
    const techOf = (el: HTMLElement, n: number) =>
      new Map(
        [
          ...$(el, `fieldset[aria-label="Achievement ${n} technologies"]`).querySelectorAll(
            'label',
          ),
        ].map((l) => [l.textContent?.trim(), l.querySelector('input') as HTMLInputElement]),
      );
    const highlightsSent = () =>
      (experiences.update.mock.calls[0][1] as { highlights: Record<string, unknown>[] }).highlights;

    it('loads the technologies and labels of an achievement', async () => {
      const { el } = await render('/admin/experiences/e-kx');
      expect($(el, 'details.extras summary').textContent).toContain('1 technology, 1 label');
      expect(techOf(el, 1).get('NgRx')?.checked).toBe(true);
      expect(techOf(el, 1).get('Angular')?.checked).toBe(false);
      expect(field(el, 'Achievement 1 label 1 name').value).toBe('team');
      expect(field(el, 'Achievement 1 label 1 value').value).toBe('platform');
    });

    it("offers only the job's tech stack", async () => {
      const { el, settle } = await render('/admin/experiences/e-kx');
      expect([...techOf(el, 1).keys()]).toEqual(['Angular', 'NgRx']);
      (el.querySelector('input[type="checkbox"][value="s-jest"]') as HTMLInputElement).click();
      await settle();
      expect([...techOf(el, 1).keys()]).toEqual(['Angular', 'NgRx', 'Jest']);
    });

    it('saves the technologies and labels', async () => {
      const { el, settle } = await render('/admin/experiences/e-kx');
      techOf(el, 1).get('Angular')?.click();
      $<HTMLButtonElement>(el, 'button[aria-label="Add a label to achievement 1"]').click();
      await settle();
      type(field(el, 'Achievement 1 label 2 name'), 'squad');
      type(field(el, 'Achievement 1 label 2 value'), ' core ');
      submit(el);
      await settle();

      expect(highlightsSent()[0]).toMatchObject({
        labels: { team: 'platform', squad: 'core' },
        skillIds: ['s-ngrx', 's-angular'],
      });
      expect(highlightsSent()[1]).toMatchObject({ labels: {}, skillIds: [] });
    });

    it('removes a label', async () => {
      const { el, settle } = await render('/admin/experiences/e-kx');
      $<HTMLButtonElement>(el, 'button[aria-label="Remove label 1 of achievement 1"]').click();
      await settle();
      submit(el);
      await settle();
      expect(highlightsSent()[0]['labels']).toEqual({});
    });

    it.each([
      ['Team', 'x', 'Use lowercase letters, digits and _, starting with a letter'],
      ['company', 'x', '"company" is set automatically'],
      ['team', 'x', 'This label is already used'],
      ['squad', '', 'Value is required'],
      ['squad', 'x'.repeat(61), 'Use at most 60 characters'],
    ])('refuses the label %s="%s"', async (name, value, message) => {
      const { el, settle } = await render('/admin/experiences/e-kx');
      $<HTMLButtonElement>(el, 'button[aria-label="Add a label to achievement 1"]').click();
      await settle();
      type(field(el, 'Achievement 1 label 2 name'), name);
      type(field(el, 'Achievement 1 label 2 value'), value);
      submit(el);
      await settle();
      expect(experiences.update).not.toHaveBeenCalled();
      expect(el.textContent).toContain(message);
    });
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
