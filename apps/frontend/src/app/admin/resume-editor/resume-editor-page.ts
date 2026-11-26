import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/content/content-api.service';
import { PlainResume } from '../../public/plain-resume/plain-resume';
import { RESUME_EDIT_SLOTS, ResumeEditSlots } from '../../public/plain-resume/resume-edit-slots';
import { InlineText } from './inline-text/inline-text';
import { ItemTools } from './item-tools/item-tools';
import { ResumeEditorStore } from './resume-editor.store';
import { SectionTools } from './section-tools/section-tools';

const EDIT_SLOTS: ResumeEditSlots = { field: InlineText, item: ItemTools, section: SectionTools };

/** `/admin/resume`: the plain view `/resume`, edited in place. */
@Component({
  selector: 'app-resume-editor-page',
  imports: [PlainResume, RouterLink],
  providers: [ResumeEditorStore, { provide: RESUME_EDIT_SLOTS, useValue: EDIT_SLOTS }],
  templateUrl: './resume-editor-page.html',
  styleUrl: './resume-editor-page.scss',
})
export class ResumeEditorPage {
  protected readonly store = inject(ResumeEditorStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.error.set(null);
    this.store
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (e: unknown) => this.error.set(apiErrorMessage(e)) });
  }
}
