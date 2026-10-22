import { DestroyRef, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormField,
  FormRoot,
  applyEach,
  email,
  form,
  max,
  maxLength,
  min,
  required,
} from '@angular/forms/signals';
import type { Profile, ProfileLink } from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { ContentApi, apiErrorMessage } from '../../core/content/content-api.service';
import { httpUrl, showError, textOrNull } from '../shared/form-utils';

interface ProfileModel {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string;
  showPhone: boolean;
  location: string;
  openToRelocation: boolean;
  avatarUrl: string;
  interests: string;
  yearsInIt: number | null;
  yearsOfAngular: number | null;
  links: ProfileLink[];
}

const empty: ProfileModel = {
  fullName: '',
  headline: '',
  summary: '',
  email: '',
  phone: '',
  showPhone: false,
  location: '',
  openToRelocation: false,
  avatarUrl: '',
  interests: '',
  yearsInIt: null,
  yearsOfAngular: null,
  links: [],
};

function toModel(p: Profile): ProfileModel {
  return {
    ...p,
    phone: p.phone ?? '',
    location: p.location ?? '',
    avatarUrl: p.avatarUrl ?? '',
    interests: p.interests ?? '',
    links: p.links.map((l) => ({ ...l })),
  };
}

function toProfile(m: ProfileModel): Profile {
  return {
    fullName: m.fullName.trim(),
    headline: m.headline.trim(),
    summary: m.summary.trim(),
    email: m.email.trim(),
    phone: textOrNull(m.phone),
    showPhone: m.showPhone,
    location: textOrNull(m.location),
    openToRelocation: m.openToRelocation,
    avatarUrl: textOrNull(m.avatarUrl),
    links: m.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    interests: textOrNull(m.interests),
    yearsInIt: m.yearsInIt,
    yearsOfAngular: m.yearsOfAngular,
  };
}

/** The API accepts at most this many links. */
const MAX_LINKS = 10;

@Component({
  selector: 'app-profile-page',
  imports: [FormField, FormRoot],
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly api = inject(ContentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly model = signal<ProfileModel>(empty);

  protected readonly maxLinks = MAX_LINKS;
  protected readonly loaded = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = form(
    this.model,
    (p) => {
      required(p.fullName, { message: 'Full name is required' });
      maxLength(p.fullName, 120, { message: 'Use at most 120 characters' });
      required(p.headline, { message: 'Headline is required' });
      maxLength(p.headline, 200, { message: 'Use at most 200 characters' });
      required(p.summary, { message: 'Summary is required' });
      maxLength(p.summary, 2000, { message: 'Use at most 2000 characters' });
      required(p.email, { message: 'Email is required' });
      email(p.email, { message: 'Enter a valid email address' });
      httpUrl(p.avatarUrl);
      for (const years of [p.yearsInIt, p.yearsOfAngular]) {
        min(years, 0, { message: 'Enter a number from 0 to 80' });
        max(years, 80, { message: 'Enter a number from 0 to 80' });
      }
      applyEach(p.links, (link) => {
        required(link.label, { message: 'Label is required' });
        maxLength(link.label, 40, { message: 'Use at most 40 characters' });
        required(link.url, { message: 'Enter a URL starting with http:// or https://' });
        httpUrl(link.url);
      });
    },
    { submission: { action: () => this.save() } },
  );
  protected readonly showError = showError;

  constructor() {
    this.api
      .profile()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (profile) => {
          if (profile) this.model.set(toModel(profile));
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
