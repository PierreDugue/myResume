import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { SitePreferences, UpdateSitePreferencesRequest } from '@my-resume/api-models';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PreferencesApi } from '../../core/preferences/preferences-api.service';
import { SitePreferencesStore } from '../../core/preferences/site-preferences.store';
import { $ } from '../../testing';
import { field, renderRoute } from '../testing/render';
import { PreferencesPage, toModel, toRequest } from './preferences-page';

const prefs = (off: (keyof SitePreferences['pages'])[] = []): SitePreferences => ({
  pages: {
    overview: !off.includes('overview'),
    explore: !off.includes('explore'),
    traces: !off.includes('traces'),
    serviceMap: !off.includes('serviceMap'),
    quality: !off.includes('quality'),
    about: !off.includes('about'),
  },
});
const LABELS = [
  'Career Overview',
  'Explore',
  'Traces',
  'Service map',
  'Code quality',
  'About this site',
];

describe('toModel / toRequest', () => {
  it('copies the page flags into the form model and back', () => {
    const model = toModel(prefs(['explore']));
    expect(model).toEqual({ pages: prefs(['explore']).pages });
    expect(toRequest(model)).toEqual({ pages: prefs(['explore']).pages });
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
  const get = vi.fn(() => loaded());
  const update = vi.fn((body: UpdateSitePreferencesRequest) => saved(body));

  const render = () =>
    renderRoute(
      '/admin/preferences',
      [{ path: 'admin/preferences', component: PreferencesPage }],
      [{ provide: PreferencesApi, useValue: { get, update } }],
    );
  const save = (el: HTMLElement) => $<HTMLButtonElement>(el, 'button[type="submit"]').click();

  beforeEach(() => {
    loaded = () => of(prefs(['explore']));
    saved = (body) => of({ pages: { ...prefs().pages, ...body.pages } });
    get.mockClear();
    update.mockClear();
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

  /** Renders without waiting for pending resources (`whenStable()` would never end). */
  async function renderPending() {
    TestBed.configureTestingModule({
      providers: [{ provide: PreferencesApi, useValue: { get, update } }],
    });
    const fixture = TestBed.createComponent(PreferencesPage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      settle: async () => {
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      },
    };
  }
});
