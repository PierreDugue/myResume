import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Skill, SitePreferences, UpdateSitePreferencesRequest } from '@my-resume/api-models';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ContentApi } from '../../core/content/content-api.service';
import { PreferencesApi } from '../../core/preferences/preferences-api.service';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import { $ } from '../../testing';
import { field, renderRoute } from '../testing/render';
import { PreferencesPage, toModel, toRequest } from './preferences-page';

const prefs = (
  off: (keyof SitePreferences['pages'])[] = [],
  skillsOverTime: string[] = [],
): SitePreferences => ({
  pages: {
    overview: !off.includes('overview'),
    explore: !off.includes('explore'),
    traces: !off.includes('traces'),
    serviceMap: !off.includes('serviceMap'),
    quality: !off.includes('quality'),
    about: !off.includes('about'),
  },
  overview: { skillsOverTime },
});

const skill = (id: string, name: string, category: string, sortOrder: number): Skill => ({
  id,
  name,
  slug: id,
  category,
  level: null,
  sortOrder,
});
/** Ten skills in two categories; ids are `s1`..`s10`. */
const NAMES = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliet',
];
const SKILLS: Skill[] = NAMES.map((name, i) =>
  skill(`s${i + 1}`, name, i < 6 ? 'Core' : 'Tools', i),
);
const LABELS = [
  'Career Overview',
  'Explore',
  'Traces',
  'Service map',
  'Code quality',
  'About this site',
];

describe('toModel / toRequest', () => {
  it('copies the page flags and the overview group into the form model and back', () => {
    const loaded = prefs(['explore'], ['s2', 's1']);
    const model = toModel(loaded);
    expect(model).toEqual({ pages: loaded.pages, overview: { skillsOverTime: ['s2', 's1'] } });
    expect(toRequest(model)).toEqual({
      pages: loaded.pages,
      overview: { skillsOverTime: ['s2', 's1'] },
    });
  });

  it('does not share the selection with the loaded preferences', () => {
    const loaded = prefs([], ['s1']);
    const model = toModel(loaded);
    model.overview.skillsOverTime.push('s2');
    expect(loaded.overview.skillsOverTime).toEqual(['s1']);
  });

  it('does not share the flags with the loaded preferences', () => {
    const loaded = prefs();
    const model = toModel(loaded);
    model.pages.explore = false;
    expect(loaded.pages.explore).toBe(true);
  });
});

describe('PreferencesPage', () => {
  let loaded: () => Observable<SitePreferences>;
  let saved: (body: UpdateSitePreferencesRequest) => Observable<SitePreferences>;
  let skills: () => Observable<Skill[]>;
  const get = vi.fn(() => loaded());
  const update = vi.fn((body: UpdateSitePreferencesRequest) => saved(body));
  const listSkills = vi.fn(() => skills());

  const render = () =>
    renderRoute(
      '/admin/preferences',
      [{ path: 'admin/preferences', component: PreferencesPage }],
      [
        { provide: PreferencesApi, useValue: { get, update } },
        { provide: ContentApi, useValue: { skills: { list: listSkills } } },
      ],
    );
  const save = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();

  beforeEach(() => {
    loaded = () => of(prefs(['explore']));
    skills = () => of(SKILLS);
    saved = (body) =>
      of({
        pages: { ...prefs().pages, ...body.pages },
        overview: { skillsOverTime: body.overview?.skillsOverTime ?? [] },
      });
    get.mockClear();
    update.mockClear();
    listSkills.mockClear();
  });

  it('shows a checkbox per page with its path, checked when visitors can see it', async () => {
    const { el } = await render();
    expect($(el, 'fieldset legend').textContent?.trim()).toBe('Pages');
    expect(LABELS.map((label) => field(el, label).checked)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(field(el, 'Explore').type).toBe('checkbox');
    const labelText = (label: string) =>
      [...el.querySelectorAll('label')]
        .find((l) => l.textContent?.trim().startsWith(label))
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    expect(labelText('Explore')).toContain('/explore');
    expect(labelText('Code quality')).toContain('/dashboards/quality');
  });

  it('says the plain view is always available', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('The plain view (/resume) is always available.');
  });

  it('loads fresh preferences from the API', async () => {
    await render();
    expect(get).toHaveBeenCalledOnce();
  });

  it('saves all six flags and confirms', async () => {
    const { el, settle } = await render();
    field(el, 'Traces').click();
    await settle();
    save(el);
    await settle();

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      pages: {
        overview: true,
        explore: false,
        traces: false,
        serviceMap: true,
        quality: true,
        about: true,
      },
      overview: { skillsOverTime: [] },
    });
    expect($(el, '[role="status"]').textContent).toContain('Preferences saved');
  });

  it('updates the store, so the menu changes at once', async () => {
    const { el, settle } = await render();
    const store = TestBed.inject(SitePreferencesStore);
    expect(store.preferences()).toBeNull();
    field(el, 'Explore').click();
    await settle();
    save(el);
    await settle();
    expect(store.preferences()).toEqual(prefs());
  });

  it('warns when every page is off, without blocking the save', async () => {
    const { el, settle } = await render();
    expect(el.querySelector('.warning')).toBeNull();
    for (const label of LABELS.filter((l) => l !== 'Explore')) field(el, label).click();
    await settle();
    expect($(el, '.warning').textContent).toContain('visitors will only see the plain view');

    save(el);
    await settle();
    expect(update).toHaveBeenCalledOnce();
    expect($(el, '[role="status"]').textContent).toContain('Preferences saved');

    field(el, 'Explore').click();
    await settle();
    expect(el.querySelector('.warning')).toBeNull();
  });

  it('announces the warning through a live region that is always there', async () => {
    const { el, settle } = await render();
    const region = $(el, '[aria-live="polite"]');
    expect(region.querySelector('.warning')).toBeNull();
    for (const label of LABELS.filter((l) => l !== 'Explore')) field(el, label).click();
    await settle();
    expect($(el, '[aria-live="polite"]')).toBe(region);
    expect(region.textContent).toContain('visitors will only see the plain view');
  });

  it('clears the saved message when the form is edited afterwards', async () => {
    const { el, settle } = await render();
    field(el, 'Traces').click();
    await settle();
    save(el);
    await settle();
    expect($(el, '[role="status"]').textContent).toContain('Preferences saved');

    field(el, 'About this site').click();
    await settle();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the API error when saving fails, and keeps the form', async () => {
    saved = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'pages.explore must be a boolean value' },
          }),
      );
    const { el, settle } = await render();
    field(el, 'Traces').click();
    await settle();
    save(el);
    await settle();
    expect($(el, '[role="alert"]').textContent).toContain('pages.explore must be a boolean value.');
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(field(el, 'Traces').checked).toBe(false);
    expect(TestBed.inject(SitePreferencesStore).preferences()).toBeNull();
  });

  it('disables the save button while saving', async () => {
    const pending = new Subject<SitePreferences>();
    saved = () => pending;
    const { el, settle } = await render();
    save(el);
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(true);
    pending.next(prefs());
    pending.complete();
    await settle();
    expect($<HTMLButtonElement>(el, 'button[type="submit"]').disabled).toBe(false);
  });

  it('shows a loading state, then the form', async () => {
    const answer = new Subject<SitePreferences>();
    loaded = () => answer;
    const { el, settle } = await renderPending();
    expect($(el, '[role="status"]').textContent).toContain('Loading');
    expect(el.querySelector('form')).toBeNull();

    answer.next(prefs());
    answer.complete();
    await settle();
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('explains a failed load and can retry', async () => {
    let calls = 0;
    loaded = () =>
      calls++ === 0 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(prefs());
    const { el, settle } = await render();
    expect($(el, '[role="alert"]').textContent).toContain('Something went wrong');
    expect(el.querySelector('form')).toBeNull();

    $<HTMLButtonElement>(el, 'button.retry').click();
    await settle();
    expect(get).toHaveBeenCalledTimes(2);
    expect(field(el, 'Explore').checked).toBe(true);
  });

  describe('Skills over time', () => {
    const fieldset = (el: HTMLElement) =>
      [...el.querySelectorAll('fieldset')].find(
        (f) => f.querySelector(':scope > legend')?.textContent?.trim() === 'Skills over time',
      ) as HTMLElement;
    /** Blocked by the limit: `aria-disabled`, never `disabled`, so the keyboard can still reach it. */
    const blocked = (b: HTMLInputElement): boolean => {
      expect(b.disabled).toBe(false);
      return b.getAttribute('aria-disabled') === 'true';
    };
    const box = (el: HTMLElement, name: string) =>
      [...fieldset(el).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
        (b) => b.closest('label')?.textContent?.trim() === name,
      ) as HTMLInputElement;
    const status = (el: HTMLElement) =>
      fieldset(el).querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, ' ').trim();
    const checkFirst = async (el: HTMLElement, settle: () => Promise<void>, n: number) => {
      for (const name of NAMES.slice(0, n)) {
        if (!box(el, name).checked) box(el, name).click();
        await settle();
      }
    };

    it('has a "Skills over time" fieldset after "Pages", explaining the chart and the automatic mode', async () => {
      const { el } = await render();
      expect(
        [...el.querySelectorAll('form > fieldset > legend')].map((l) => l.textContent?.trim()),
      ).toEqual(['Pages', 'Skills over time']);
      const hint = fieldset(el).querySelector('.hint')?.textContent?.replace(/\s+/g, ' ') ?? '';
      expect(hint).toContain('up to 8');
      expect(hint).toContain('Career Overview');
      expect(hint).toContain('most used');
      expect(hint).toContain('whole career');
      expect(hint).toContain('filters');
      expect(hint).not.toContain('leaves none of the checked skills');
    });

    it('lists every skill, with the stored selection checked', async () => {
      loaded = () => of(prefs([], ['s2', 's7']));
      const { el } = await render();
      expect(listSkills).toHaveBeenCalledOnce();
      expect(fieldset(el).querySelectorAll('input[type="checkbox"]')).toHaveLength(10);
      const checked = NAMES.filter((n) => box(el, n).checked);
      expect(checked).toEqual(['Bravo', 'Golf']);
    });

    it('saves the chosen skills with the page flags', async () => {
      loaded = () => of(prefs([], ['s2']));
      const { el, settle } = await render();
      box(el, 'Alpha').click();
      await settle();
      box(el, 'Bravo').click();
      await settle();
      box(el, 'India').click();
      await settle();
      save(el);
      await settle();

      expect(update).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledWith({
        pages: prefs().pages,
        overview: { skillsOverTime: ['s1', 's9'] },
      });
      expect($(el, '.saved').textContent).toContain('Preferences saved');
      expect(box(el, 'India').checked).toBe(true);
    });

    it('sends [] when everything is unchecked (back to automatic)', async () => {
      loaded = () => of(prefs([], ['s2']));
      const { el, settle } = await render();
      box(el, 'Bravo').click();
      await settle();
      save(el);
      await settle();
      expect(update).toHaveBeenCalledWith({
        pages: prefs().pages,
        overview: { skillsOverTime: [] },
      });
    });

    it.each([
      [0, 'Automatic: the 8 most used skills'],
      [1, '1 of 8 selected'],
      [7, '7 of 8 selected'],
      [8, '8 of 8 selected You can pick up to 8 skills: uncheck one to pick another.'],
    ])('with %i checked, says "%s"', async (n, expected) => {
      const { el, settle } = await render();
      await checkFirst(el, settle, n);
      expect(status(el)).toBe(expected);
    });

    it('passes the limit to the picker: at 8, the other boxes are blocked until one is unchecked', async () => {
      const { el, settle } = await render();
      await checkFirst(el, settle, 8);
      expect(blocked(box(el, 'India'))).toBe(true);

      box(el, 'Hotel').click();
      await settle();
      expect(blocked(box(el, 'India'))).toBe(false);
    });

    it('opens with the limit already reached when 8 skills are stored', async () => {
      loaded = () => of(prefs([], ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']));
      const { el } = await render();
      expect(blocked(box(el, 'India'))).toBe(true);
      expect(status(el)).toContain('8 of 8 selected');
    });

    it('does not show the limit message below the limit', async () => {
      const { el, settle } = await render();
      await checkFirst(el, settle, 7);
      expect(status(el)).toBe('7 of 8 selected');
      expect(blocked(box(el, 'India'))).toBe(false);
    });

    it('shows the API error when the selection is refused (400), and keeps the form', async () => {
      saved = () =>
        throwError(
          () => new HttpErrorResponse({ status: 400, error: { message: 'Unknown skill ids' } }),
        );
      const { el, settle } = await render();
      box(el, 'Alpha').click();
      await settle();
      save(el);
      await settle();
      expect($(el, '[role="alert"]').textContent).toContain('Unknown skill ids.');
      expect(el.querySelector('.saved')).toBeNull();
      expect(box(el, 'Alpha').checked).toBe(true);
    });

    it('shows the error state with a retry when the skills cannot be loaded', async () => {
      let calls = 0;
      skills = () =>
        calls++ === 0 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(SKILLS);
      const { el, settle } = await render();
      expect($(el, '[role="alert"]').textContent).toContain('Something went wrong');
      expect(el.querySelector('form')).toBeNull();

      $<HTMLButtonElement>(el, 'button.retry').click();
      await settle();
      expect(el.querySelector('form')).not.toBeNull();
      expect(box(el, 'Alpha')).toBeTruthy();
    });

    it('shows one loading state until both the preferences and the skills are there', async () => {
      const prefsAnswer = new Subject<SitePreferences>();
      const skillsAnswer = new Subject<Skill[]>();
      loaded = () => prefsAnswer;
      skills = () => skillsAnswer;
      const { el, detect, settle } = await renderPending();
      prefsAnswer.next(prefs());
      prefsAnswer.complete();
      await detect();
      expect($(el, '[role="status"]').textContent).toContain('Loading');
      expect(el.querySelector('form')).toBeNull();

      skillsAnswer.next(SKILLS);
      skillsAnswer.complete();
      await settle();
      expect(el.querySelector('form')).not.toBeNull();
    });
  });

  /** Renders without waiting for pending resources (`whenStable()` would never end). */
  async function renderPending() {
    TestBed.configureTestingModule({
      providers: [
        { provide: PreferencesApi, useValue: { get, update } },
        { provide: ContentApi, useValue: { skills: { list: listSkills } } },
      ],
    });
    const fixture = TestBed.createComponent(PreferencesPage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      /** Renders what is there now, without waiting for pending requests. */
      detect: async () => {
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();
      },
      settle: async () => {
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      },
    };
  }
});
