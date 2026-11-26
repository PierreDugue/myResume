import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  EMPTY_PROFILE,
  MAX_LINKS,
  profileSchema,
  toProfile,
  toProfileModel,
} from '../../profile/profile-form';
import { showError } from '../../shared/form-utils';
import { ResumeEditorStore } from '../resume-editor.store';
import { SaveStatus } from '../save-status';

let nextId = 0;

/** "Edit links" in the profile header: the profile links, checked with the profile rules. */
@Component({
  selector: 'app-profile-links-form',
  imports: [FormField],
  templateUrl: './links-form.html',
})
export class ProfileLinksForm {
  readonly closed = output<void>();

  private readonly store = inject(ResumeEditorStore);
  private readonly model = signal(this.profileModel());

  protected readonly uid = `links-${nextId++}`;
  protected readonly maxLinks = MAX_LINKS;
  protected readonly form = form(this.model, profileSchema);
  protected readonly status = new SaveStatus(inject(DestroyRef));
  protected readonly showError = showError;

  protected addLink(): void {
    this.model.update((m) => ({ ...m, links: [...m.links, { label: '', url: '' }] }));
  }

  protected removeLink(index: number): void {
    this.model.update((m) => ({ ...m, links: m.links.filter((_, i) => i !== index) }));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const links = this.form.links();
    links.markAsTouched();
    if (links.invalid()) return;
    // The links as typed now; the rest of the profile as saved when the write's turn comes.
    const { links: typed } = this.model();
    this.status.run(
      this.store.saveProfile((current) => toProfile({ ...toProfileModel(current), links: typed })),
      () => this.closed.emit(),
    );
  }

  private profileModel() {
    const profile = this.store.resume()?.profile;
    return profile ? toProfileModel(profile) : EMPTY_PROFILE;
  }
}
