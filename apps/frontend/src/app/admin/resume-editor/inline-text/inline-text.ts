import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { ResumeFieldRef } from '../../../public/plain-resume/resume-edit-slots';
import { showError } from '../../shared/form-utils';
import { FieldSession, fieldInfo, openField } from '../editable-fields';
import { ResumeEditorStore } from '../resume-editor.store';
import { SaveStatus } from '../save-status';

let nextId = 0;

/**
 * Whether this Enter belongs to an input method (it picks a candidate rather than saving). Safari
 * commits a composition with an Enter whose `isComposing` is false but whose `keyCode` is 229.
 */
const composing = (event: KeyboardEvent) => event.isComposing || event.keyCode === 229;

/**
 * A text of the plain view, edited in place (the `field` slot): a button showing the text, which
 * opens a field. Enter (Ctrl/Cmd+Enter in a text area) or leaving the field saves; Escape cancels.
 */
@Component({
  selector: 'app-inline-text',
  imports: [FormField],
  templateUrl: './inline-text.html',
  styleUrl: './inline-text.scss',
})
export class InlineText {
  readonly ref = input.required<ResumeFieldRef>();
  readonly value = input.required<string | null>();

  private readonly store = inject(ResumeEditorStore);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly textButton = viewChild<ElementRef<HTMLButtonElement>>('text');
  private readonly editor = viewChild<ElementRef<HTMLElement>>('editor');

  protected readonly errorId = `inline-text-error-${nextId++}`;
  protected readonly info = computed(() => fieldInfo(this.ref()));
  protected readonly session = signal<FieldSession | null>(null);
  protected readonly status = new SaveStatus(inject(DestroyRef));
  protected readonly showError = showError;
  /** The value the API last refused, so leaving the field doesn't send it again. */
  private rejected: string | null = null;
  /** The saved value: the text when the field opened, then the last value the API accepted. */
  private baseline = '';

  protected open(): void {
    const session = openField(this.ref(), this.store, this.injector);
    if (!session) return;
    this.status.reset();
    this.rejected = null;
    this.baseline = session.initial;
    this.session.set(session);
    afterNextRender(() => this.editor()?.nativeElement.focus(), { injector: this.injector });
  }

  protected keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      // While saving, the field stays open so a failure still shows under it.
      if (this.status.busy()) return;
      this.status.reset();
      this.close(true);
    } else if (
      event.key === 'Enter' &&
      !composing(event) &&
      (!this.info().multiline || event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      this.save(true);
    }
  }

  /** Leaving the field saves it, unless the API just refused that same value. */
  protected blur(): void {
    if (this.session()?.field().value() !== this.rejected) this.save(false);
  }

  /**
   * Saves the typed value; ignored once the field is closed (closing blurs it) or while saving.
   * `byKey`: saved with the keyboard, so focus may go back to the text once the field closes.
   * Leaving the field (blur) never pulls focus back: it is on the control the user went to.
   * Text typed while the save was pending is saved once it succeeds, in place of being lost.
   */
  private save(byKey: boolean): void {
    const session = this.session();
    if (!session || this.status.busy()) return;
    const field = session.field();
    const value = field.value();
    if (value === this.baseline) {
      this.status.reset();
      this.close(byKey);
      return;
    }
    field.markAsTouched();
    if (field.invalid()) {
      this.status.refuse();
      return;
    }
    this.status.run(
      session.save(value),
      () => this.saved(session, value, byKey),
      () => (this.rejected = value),
    );
  }

  /** After a successful save: save again what was typed meanwhile, or close the field. */
  private saved(session: FieldSession, value: string, byKey: boolean): void {
    this.baseline = value;
    if (session.field().value() !== value) this.save(byKey);
    else this.close(byKey && this.hasFocus());
  }

  private close(refocus: boolean): void {
    this.session.set(null);
    this.rejected = null;
    if (refocus) {
      afterNextRender(() => this.textButton()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  /** Whether focus is still in this field when its save finishes (read after the blur, not during it). */
  private hasFocus(): boolean {
    return this.host.nativeElement.contains(document.activeElement);
  }
}
