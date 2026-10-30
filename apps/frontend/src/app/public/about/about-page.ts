import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { ResumeResponse } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { Panel } from '../../shared/panels/panel/panel';
import { StatPanel } from '../../shared/panels/stat/stat-panel';

export interface ContentCount {
  label: string;
  value: number;
}

/** What the live panel shows: how much content the API serves right now. */
export function contentCounts(r: ResumeResponse): ContentCount[] {
  return [
    { label: 'Experiences', value: r.experiences.length },
    { label: 'Highlights', value: r.experiences.reduce((n, e) => n + e.highlights.length, 0) },
    { label: 'Skills', value: r.skills.length },
    { label: 'Projects', value: r.projects.length },
    { label: 'Project spans', value: r.projects.reduce((n, p) => n + p.spans.length, 0) },
    { label: 'Education', value: r.education.length },
  ];
}

/** "How this site was built": what the site shows, where its data comes from, and how it's made. */
@Component({
  selector: 'app-about-page',
  imports: [RouterLink, Panel, StatPanel],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  private readonly api = inject(ContentApi);

  protected readonly repo = 'https://github.com/PierreDugue/myResume';
  protected readonly resume = rxResource({ stream: () => this.api.resume() });
  protected readonly counts = computed(() =>
    this.resume.hasValue() ? contentCounts(this.resume.value()) : [],
  );
}
