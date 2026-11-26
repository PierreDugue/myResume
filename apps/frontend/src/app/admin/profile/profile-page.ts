import { DestroyRef, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ContentApi, apiErrorMessage } from '../../core/content/content-api.service';
import { showError } from '../shared/form-utils';
import {
  EMPTY_PROFILE,
  MAX_LINKS,
  ProfileModel,
  profileSchema,
  toProfile,
  toProfileModel,
} from './profile-form';

@Component({
  selector: 'app-profile-page',
  imports: [FormField, FormRoot],
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly api = inject(ContentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly model = signal<ProfileModel>(EMPTY_PROFILE);

  protected readonly maxLinks = MAX_LINKS;
  protected readonly loaded = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = form(this.model, profileSchema, {
    submission: { action: () => this.save() },
  });
  protected readonly showError = showError;

  constructor() {
    this.api
      .profile()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (profile) => {
          if (profile) this.model.set(toProfileModel(profile));
          this.loaded.set(true);
        },
        error: (e: unknown) => this.error.set(apiErrorMessage(e)),
      });
  }

  protected addLink(): void {
    this.model.update((m) => ({ ...m, links: [...m.links, { label: '', url: '' }] }));
  }

  protected removeLink(index: number): void {
    this.model.update((m) => ({ ...m, links: m.links.filter((_, i) => i !== index) }));
  }

  private async save(): Promise<void> {
    this.saved.set(false);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.saveProfile(toProfile(this.model())).pipe(takeUntilDestroyed(this.destroyRef)),
      );
      this.saved.set(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }
}
