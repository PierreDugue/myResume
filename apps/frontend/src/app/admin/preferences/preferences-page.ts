import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import type {
  OverviewPreferences,
  PagePreferences,
  SitePreferences,
  Skill,
  UpdateSitePreferencesRequest,
} from '@my-resume/api-models';
import { SKILLS_OVER_TIME_MAX } from '@my-resume/resume-metrics';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ContentApi, apiErrorMessage } from '../../core/content/content-api.service';
import { PreferencesApi } from '../../core/preferences/preferences-api.service';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import { SkillPicker } from '../shared/skill-picker/skill-picker';
import { NAV_ITEMS } from '../../layout/nav-items';

/** One key per preference group (`pages`, `overview`): a new group is one more fieldset and one more key. */
export interface PreferencesModel {
  pages: PagePreferences;
  overview: OverviewPreferences;
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
  overview: { skillsOverTime: [] },
};

export function toModel(prefs: SitePreferences): PreferencesModel {
  return {
    pages: { ...prefs.pages },
    overview: { skillsOverTime: [...prefs.overview.skillsOverTime] },
  };
}

/** Sends every flag, so the saved preferences are exactly what the form shows. */
export function toRequest(model: PreferencesModel): UpdateSitePreferencesRequest {
  return {
    pages: { ...model.pages },
    overview: { skillsOverTime: [...model.overview.skillsOverTime] },
  };
}

/** `/admin/preferences`: which public pages visitors see, and which skills the overview chart draws. */
@Component({
  selector: 'app-preferences-page',
  imports: [FormField, FormRoot, SkillPicker],
  templateUrl: './preferences-page.html',
  styleUrl: './preferences-page.scss',
})
export class PreferencesPage {
  private readonly api = inject(PreferencesApi);
  private readonly content = inject(ContentApi);
  private readonly store = inject(SitePreferencesStore);

  /** Preferences and skills, loaded together (one loading and error state). Fresh, not from the store, so the form never starts from stale data. */
  protected readonly loaded = rxResource({
    stream: () => forkJoin({ preferences: this.api.get(), skills: this.content.skills.list() }),
  });
  private readonly model = linkedSignal<SitePreferences | undefined, PreferencesModel>({
    source: () => (this.loaded.hasValue() ? this.loaded.value().preferences : undefined),
    computation: (prefs) => (prefs ? toModel(prefs) : EMPTY),
  });

  protected readonly pages = NAV_ITEMS;
  protected readonly skillsMax = SKILLS_OVER_TIME_MAX;
  protected readonly skills = computed<Skill[]>(() =>
    this.loaded.hasValue() ? this.loaded.value().skills : [],
  );
  protected readonly skillsCount = computed(() => this.model().overview.skillsOverTime.length);
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
