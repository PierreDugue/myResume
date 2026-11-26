import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { ResumeResponse, Skill } from '@my-resume/api-models';
import { formatPeriod } from '../../shared/format/period';
import { RESUME_EDIT_SLOTS } from './resume-edit-slots';
import { ResumeText } from './resume-text';

/**
 * The classic one-page resume layout, shared by the public `/resume` page and the admin editor.
 * Presentational: with `RESUME_EDIT_SLOTS` provided, it renders the editor's components in its
 * slots (texts, item tools, section tools) and keeps empty sections and texts visible.
 */
@Component({
  selector: 'app-plain-resume',
  imports: [NgComponentOutlet, ResumeText],
  templateUrl: './plain-resume.html',
  styleUrl: './plain-resume.scss',
})
export class PlainResume {
  readonly resume = input.required<ResumeResponse>();

  protected readonly slots = inject(RESUME_EDIT_SLOTS, { optional: true });
  protected readonly editable = this.slots !== null;
  protected readonly period = formatPeriod;

  private readonly skillNames = computed(
    () => new Map(this.resume().skills.map((s) => [s.id, s.name])),
  );

  protected readonly skillGroups = computed(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of this.resume().skills) {
      groups.set(skill.category, [...(groups.get(skill.category) ?? []), skill]);
    }
    return [...groups].map(([category, skills]) => ({ category, skills }));
  });

  protected stack(skillIds: string[]): string {
    return skillIds
      .map((id) => this.skillNames().get(id))
      .filter(Boolean)
      .join(', ');
  }
}
