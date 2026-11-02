import { Component, computed, input, model } from '@angular/core';
import type { Skill } from '@my-resume/api-models';

/**
 * Checkboxes for skills, grouped by category. Two-way bind the ids: `[(selected)]`.
 * With `max`, the unchecked boxes are blocked once that many are selected (checked ones stay free
 * so they can be unchecked). Blocked boxes use `aria-disabled` rather than `disabled`, so keyboard
 * users can still reach them, and a click on one is cancelled.
 */
@Component({
  selector: 'app-skill-picker',
  template: `
    <div class="groups">
      @for (group of groups(); track group.category) {
        <fieldset>
          <legend>{{ group.category }}</legend>
          @for (skill of group.skills; track skill.id) {
            <label>
              <input
                type="checkbox"
                [value]="skill.id"
                [checked]="selected().includes(skill.id)"
                [attr.aria-disabled]="isBlocked(skill.id) ? 'true' : null"
                (click)="cancelIfBlocked($event, skill.id)"
                (change)="toggle(skill.id)"
              />
              {{ skill.name }}
            </label>
          }
        </fieldset>
      }
    </div>
  `,
  styles: `
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-3);
    }
    fieldset {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
    }
    legend {
      padding: 0 var(--space-1);
      color: var(--color-text-muted);
      font-size: 0.8125rem;
    }
    label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 400;
    }
    label:has(input[aria-disabled='true']) {
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
    input[aria-disabled='true'] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class SkillPicker {
  readonly skills = input.required<Skill[]>();
  readonly selected = model<string[]>([]);
  /** Most skills that can be selected; `null` = no limit. */
  readonly max = input<number | null>(null);

  protected readonly atLimit = computed(() => {
    const max = this.max();
    return max !== null && this.selected().length >= max;
  });

  protected readonly groups = computed(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of this.skills()) {
      groups.set(skill.category, [...(groups.get(skill.category) ?? []), skill]);
    }
    return [...groups].map(([category, skills]) => ({ category, skills }));
  });

  protected isBlocked(id: string): boolean {
    return this.atLimit() && !this.selected().includes(id);
  }

  /** Returns nothing on purpose: a handler returning `false` would cancel every click. */
  protected cancelIfBlocked(event: Event, id: string): void {
    if (this.isBlocked(id)) event.preventDefault();
  }

  protected toggle(id: string): void {
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
}
