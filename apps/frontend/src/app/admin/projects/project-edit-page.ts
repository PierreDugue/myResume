import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form, maxLength, pattern, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { CreateProjectRequest, Project } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { editPage } from '../shared/edit-page';
import { endOnOrAfterStart, httpUrl, showError, textOrNull } from '../shared/form-utils';
import { SkillPicker } from '../shared/skill-picker/skill-picker';

interface ProjectModel {
  title: string;
  slug: string;
  description: string;
  url: string;
  repoUrl: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
}

const empty: ProjectModel = {
  title: '',
  slug: '',
  description: '',
  url: '',
  repoUrl: '',
  imageUrl: '',
  startDate: '',
  endDate: '',
};

function toModel(p: Project): ProjectModel {
  return {
    title: p.title,
    slug: p.slug,
    description: p.description,
    url: p.url ?? '',
    repoUrl: p.repoUrl ?? '',
    imageUrl: p.imageUrl ?? '',
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
  };
}

function toRequest(m: ProjectModel, skillIds: string[]): CreateProjectRequest {
  const slug = textOrNull(m.slug);
  return {
    ...(slug && { slug }),
    title: m.title.trim(),
    description: m.description.trim(),
    url: textOrNull(m.url),
    repoUrl: textOrNull(m.repoUrl),
    imageUrl: textOrNull(m.imageUrl),
    startDate: textOrNull(m.startDate),
    endDate: textOrNull(m.endDate),
    skillIds,
  };
}

@Component({
  selector: 'app-project-edit-page',
  imports: [FormField, FormRoot, RouterLink, SkillPicker],
  templateUrl: './project-edit-page.html',
})
export class ProjectEditPage {
  private readonly content = inject(ContentApi);
  private readonly model = signal<ProjectModel>(empty);
  protected readonly selectedSkills = signal<string[]>([]);
  protected readonly skills = rxResource({ stream: () => this.content.skills.list() });
  protected readonly page = editPage<Project>(
    () => this.content.projects.list(),
    (p) => {
      this.model.set(toModel(p));
      this.selectedSkills.set([...p.skillIds]);
    },
  );
  protected readonly form = form(
    this.model,
    (p) => {
      required(p.title, { message: 'Title is required' });
      maxLength(p.title, 120, { message: 'Use at most 120 characters' });
      pattern(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, {
        message: 'Use lowercase letters and digits separated by dashes',
      });
      required(p.description, { message: 'Description is required' });
      maxLength(p.description, 2000, { message: 'Use at most 2000 characters' });
      httpUrl(p.url);
      httpUrl(p.repoUrl);
      httpUrl(p.imageUrl);
      endOnOrAfterStart(p.startDate, p.endDate);
    },
    {
      submission: {
        action: () => {
          const body = toRequest(this.model(), this.selectedSkills());
          const api = this.content.projects;
          const { isNew, id } = this.page;
          return this.page.save(isNew ? api.create(body) : api.update(id, body));
        },
      },
    },
  );
  /** The three URL fields, rendered with the same markup. */
  protected readonly links = [
    { id: 'pr-url', label: 'Website URL', field: this.form.url },
    { id: 'pr-repo-url', label: 'Repository URL', field: this.form.repoUrl },
    { id: 'pr-image-url', label: 'Image URL', field: this.form.imageUrl },
  ];
  protected readonly showError = showError;
}
