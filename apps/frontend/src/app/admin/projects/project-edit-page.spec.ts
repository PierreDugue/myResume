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
});
