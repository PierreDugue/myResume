import { Component } from '@angular/core';
import { of } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { site, skills } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { ProjectEditPage } from './project-edit-page';

@Component({ template: 'list' })
class List {}

describe('ProjectEditPage', () => {
  const projects = {
    list: vi.fn(() => of([site])),
    create: vi.fn((b: object) => of({ id: 'new', ...b })),
    update: vi.fn((id: string, b: object) => of({ id, ...b })),
  };
  const api = { projects, skills: { list: vi.fn(() => of(skills)) } };
  const render = (url: string) =>
    renderRoute(
      url,
      [
        { path: 'admin/projects', component: List },
        { path: 'admin/projects/:id', component: ProjectEditPage },
      ],
      [{ provide: ContentApi, useValue: api }],
    );

  beforeEach(() => Object.values(projects).forEach((fn) => fn.mockClear()));

  it('edits a project, including its skills; empty URLs are saved as null', async () => {
    const { el, settle } = await render('/admin/projects/p-site');
    expect(field(el, 'Title').value).toBe('Pierre O11y');
    type(field(el, 'Website URL'), '');
    (el.querySelector('input[type="checkbox"][value="s-jest"]') as HTMLInputElement).click();
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(projects.update).toHaveBeenCalledWith('p-site', {
      slug: 'pierre-o11y',
      title: 'Pierre O11y',
      description: 'This site.',
      url: null,
      repoUrl: null,
      imageUrl: null,
      startDate: '2026-10-21',
      endDate: null,
      skillIds: ['s-angular', 's-jest'],
      spans: [
        {
          id: 'sp-spec',
          depth: 0,
          name: 'Specification',
          startDate: '2026-10-21',
          endDate: '2026-10-21',
          note: 'The spec.',
          skillIds: [],
        },
        {
          id: 'sp-features',
          depth: 0,
          name: 'Features',
          startDate: '2026-10-22',
          endDate: null,
          note: null,
          skillIds: ['s-angular'],
        },
        {
          id: 'sp-auth',
          depth: 1,
          name: 'Auth',
          startDate: '2026-10-22',
          endDate: '2026-10-22',
          note: null,
          skillIds: [],
        },
      ],
    });
  });

  it('creates a project without a slug (the API generates it)', async () => {
    const { el, settle } = await render('/admin/projects/new');
    type(field(el, 'Title'), 'New thing');
    type(field(el, 'Description'), 'Something new.');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    const body = projects.create.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('slug');
    expect(body).toMatchObject({ title: 'New thing', description: 'Something new.' });
  });

  it('rejects a slug that is not lowercase words separated by dashes', async () => {
    const { el, settle } = await render('/admin/projects/p-site');
    type(field(el, 'Slug'), 'Not A Slug');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(projects.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Use lowercase letters and digits separated by dashes');
  });

  it('rejects a URL that is not http(s)', async () => {
    const { el, settle } = await render('/admin/projects/p-site');
    type(field(el, 'Website URL'), 'javascript:alert(1)');
    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    await settle();
    expect(projects.update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a URL starting with http:// or https://');
  });

  describe('spans (the trace outline)', () => {
    const click = (el: HTMLElement, label: string) =>
      $<HTMLButtonElement>(el, `button[aria-label="${label}"]`).click();
    const submit = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    const sentSpans = () =>
      (projects.update.mock.calls[0][1] as { spans: Record<string, unknown>[] }).spans;
    const levels = (el: HTMLElement) =>
      [...el.querySelectorAll('li.span')].map((li) => li.getAttribute('aria-level'));

    it('loads the spans as an outline', async () => {
      const { el } = await render('/admin/projects/p-site');
      expect(field(el, 'Span 1 name').value).toBe('Specification');
      expect(field(el, 'Span 1 note').value).toBe('The spec.');
      expect(field(el, 'Span 2 end').value).toBe('');
      expect(field(el, 'Span 3 name').value).toBe('Auth');
      expect(levels(el)).toEqual(['1', '1', '2']);
    });

    it('indents, outdents, moves and removes spans with their sub-spans', async () => {
      const { el, settle } = await render('/admin/projects/p-site');
      click(el, 'Indent span 2');
      await settle();
      expect(levels(el)).toEqual(['1', '2', '3']);
      click(el, 'Outdent span 2');
      await settle();
      click(el, 'Move span 2 up');
      await settle();
      expect(field(el, 'Span 1 name').value).toBe('Features');
      expect(field(el, 'Span 2 name').value).toBe('Auth');
      expect(levels(el)).toEqual(['1', '2', '1']);
      click(el, 'Remove span 1');
      await settle();
      expect(field(el, 'Span 1 name').value).toBe('Specification');
      expect(el.querySelectorAll('li.span')).toHaveLength(1);
    });

    it('saves the outline as depths, keeping ids and adding new spans', async () => {
      const { el, settle } = await render('/admin/projects/p-site');
      $<HTMLButtonElement>(el, 'button.add-span').click();
      await settle();
      type(field(el, 'Span 4 name'), ' Polish ');
      type(field(el, 'Span 4 start'), '2026-10-24');
      click(el, 'Indent span 4');
      await settle();
      submit(el);
      await settle();
      expect(sentSpans().map((s) => [s['id'], s['depth'], s['name']])).toEqual([
        ['sp-spec', 0, 'Specification'],
        ['sp-features', 0, 'Features'],
        ['sp-auth', 1, 'Auth'],
        [undefined, 1, 'Polish'],
      ]);
      expect(sentSpans()[3]).toMatchObject({ endDate: null, note: null, skillIds: [] });
    });

    it("offers the project's tech stack for each span", async () => {
      const { el, settle } = await render('/admin/projects/p-site');
      const tech = () => [
        ...$(el, 'fieldset[aria-label="Span 1 technologies"]').querySelectorAll('label'),
      ];
      expect(tech().map((l) => l.textContent?.trim())).toEqual(['Angular']);
      tech()[0].querySelector('input')?.click();
      await settle();
      submit(el);
      await settle();
      expect(sentSpans()[0]['skillIds']).toEqual(['s-angular']);
    });

    it('requires a name and a start date for each span', async () => {
      const { el, settle } = await render('/admin/projects/p-site');
      $<HTMLButtonElement>(el, 'button.add-span').click();
      await settle();
      submit(el);
      await settle();
      expect(projects.update).not.toHaveBeenCalled();
      expect(el.textContent).toContain('Name the span');
      expect(el.textContent).toContain('Start date is required');
    });

    it('checks the outline against its parents and the project dates before saving', async () => {
      const { el, settle } = await render('/admin/projects/p-site');
      type(field(el, 'Start date'), '2026-10-22');
      type(field(el, 'Span 3 end'), '2026-10-30');
      type(field(el, 'Span 2 end'), '2026-10-29');
      submit(el);
      await settle();
      expect(projects.update).not.toHaveBeenCalled();
      const errors = $(el, '.outline-errors').textContent ?? '';
      expect(errors).toContain('Span 1 "Specification" can\'t start before the project');
      expect(errors).toContain('Span 3 "Auth" can\'t end after "Features"');
    });
  });
});
