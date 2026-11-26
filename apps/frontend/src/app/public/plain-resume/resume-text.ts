import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RESUME_EDIT_SLOTS, type ResumeFieldRef } from './resume-edit-slots';

/** One text of the plain view: the plain text, or (in the admin editor) the `field` slot. */
@Component({
  selector: 'app-resume-text',
  imports: [NgComponentOutlet],
  // No whitespace around the text: the plain view's headings join texts with " · " and ", ".
  template: `<ng-container *ngComponentOutlet="field; inputs: inputs()" />{{
      field ? '' : value()
    }}`,
})
export class ResumeText {
  readonly ref = input.required<ResumeFieldRef>();
  readonly value = input.required<string | null>();

  protected readonly field = inject(RESUME_EDIT_SLOTS, { optional: true })?.field ?? null;
  protected readonly inputs = computed(() => ({ ref: this.ref(), value: this.value() }));
}
