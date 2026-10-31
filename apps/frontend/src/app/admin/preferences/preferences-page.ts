import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import type {
  PagePreferences,
  SitePreferences,
  UpdateSitePreferencesRequest,
} from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/content/content-api.service';
import { PreferencesApi } from '../../core/preferences/preferences-api.service';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import { NAV_ITEMS } from '../../layout/nav-items';

/** One key per preference group (`pages` for now): a new group is one more fieldset and one more key. */
export interface PreferencesModel {
  pages: PagePreferences;
}

const EMPTY: PreferencesModel = {
  pages: {
    overview: true,
    explore: true,
    traces: true,
    serviceMap: true,
    quality: true,
    about: true,
  },
};

export function toModel(prefs: SitePreferences): PreferencesModel {
  return { pages: { ...prefs.pages } };
}

/** Sends every flag, so the saved preferences are exactly what the form shows. */
export function toRequest(model: PreferencesModel): UpdateSitePreferencesRequest {
  return { pages: { ...model.pages } };
}

/** `/admin/preferences`: which public pages visitors see. */
@Component({
  selector: 'app-preferences-page',
  imports: [FormField, FormRoot],
  templateUrl: './preferences-page.html',
  styleUrl: './preferences-page.scss',
})
export class PreferencesPage {
  private readonly api = inject(PreferencesApi);
  private readonly store = inject(SitePreferencesStore);

  /** Loaded fresh (not from the store), so the form never starts from stale data. */
  protected readonly loaded = rxResource({ stream: () => this.api.get() });
  private readonly model = linkedSignal<SitePreferences | undefined, PreferencesModel>({
    source: () => (this.loaded.hasValue() ? this.loaded.value() : undefined),
    computation: (prefs) => (prefs ? toModel(prefs) : EMPTY),
  });

  protected readonly pages = NAV_ITEMS;
  /** True after a save, until the form is edited again (or reloaded). */
  protected readonly saved = linkedSignal<PreferencesModel, boolean>({
    source: this.model,
    computation: () => false,
  });
  protected readonly error = signal<string | null>(null);
  protected readonly nothingVisible = computed(() =>
    Object.values(this.model().pages).every((v) => !v),
  );
  protected readonly form = form(this.model, {
    submission: { action: () => this.save() },
  });

  private async save(): Promise<void> {
    this.saved.set(false);
    this.error.set(null);
    try {
      await firstValueFrom(this.store.save(toRequest(this.model())));
      this.saved.set(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }
}
