import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Skill } from '@my-resume/api-models';
import { ContentApi } from '../../core/content/content-api.service';
import { formatPeriod } from '../../shared/format/period';

/** The classic resume: readable, printable (Save as PDF), and ATS-friendly. */
@Component({
  selector: 'app-plain-resume-page',
  templateUrl: './plain-resume-page.html',
  styleUrl: './plain-resume-page.scss',
})
export class PlainResumePage {
  private readonly api = inject(ContentApi);

  protected readonly resume = rxResource({ stream: () => this.api.resume() });
  protected readonly period = formatPeriod;

  private readonly skillNames = computed(() => {
    const skills = this.resume.hasValue() ? this.resume.value().skills : [];
    return new Map(skills.map((s) => [s.id, s.name]));
  });

  protected readonly skillGroups = computed(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of this.resume.hasValue() ? this.resume.value().skills : []) {
      groups.set(skill.category, [...(groups.get(skill.category) ?? []), skill]);
    }
    return [...groups].map(([category, skills]) => ({
      category,
      names: skills.map((s) => s.name).join(', '),
    }));
  });

  protected stack(skillIds: string[]): string {
    return skillIds
      .map((id) => this.skillNames().get(id))
      .filter(Boolean)
      .join(', ');
  }

  protected print(): void {
    window.print();
  }
}
