import { TestBed } from '@angular/core/testing';
import type { SitePreferences, UpdateSitePreferencesRequest } from '@my-resume/api-models';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';
import { PreferencesApi } from './preferences-api.service';
import { SitePreferencesStore } from './site-preferences.store';

const prefs = (explore = true): SitePreferences => ({
  pages: {
    overview: true,
    explore,
    traces: true,
    serviceMap: true,
    quality: true,
    about: true,
  },
});

describe('SitePreferencesStore', () => {
  let answer: () => Observable<SitePreferences>;
  let patch: (body: UpdateSitePreferencesRequest) => Observable<SitePreferences>;
  const get = vi.fn(() => answer());
  const update = vi.fn((body: UpdateSitePreferencesRequest) => patch(body));
  let store: SitePreferencesStore;

  beforeEach(() => {
    answer = () => of(prefs());
    patch = () => of(prefs(false));
    get.mockClear();
    update.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: PreferencesApi, useValue: { get, update } }],
    });
    store = TestBed.inject(SitePreferencesStore);
  });

  it('does not know the preferences before they are loaded', () => {
    expect(store.preferences()).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('load() fetches the preferences into the signal', async () => {
    await firstValueFrom(store.load());
    expect(store.preferences()).toEqual(prefs());
  });

  it('shares one request between concurrent load() calls', async () => {
    const pending = new Subject<SitePreferences>();
    answer = () => pending;
    const first = firstValueFrom(store.load());
    const second = firstValueFrom(store.load());
    expect(get).toHaveBeenCalledOnce();
    pending.next(prefs(false));
    pending.complete();
    await Promise.all([first, second]);
    expect(store.preferences()).toEqual(prefs(false));
  });

  it('hands every caller the same observable while a request is pending', () => {
    answer = () => new Subject<SitePreferences>();
    expect(store.load()).toBe(store.load());
  });

  it('keeps the request going when every caller stops waiting', () => {
    const pending = new Subject<SitePreferences>();
    answer = () => pending;
    store.load().subscribe().unsubscribe(); // e.g. the route guard gave up after its timeout
    expect(pending.observed).toBe(true);
    pending.next(prefs(false));
    pending.complete();
    expect(store.preferences()).toEqual(prefs(false));
    expect(get).toHaveBeenCalledOnce();
  });

  it('does not ask again once loaded', async () => {
    await firstValueFrom(store.load());
    await firstValueFrom(store.load());
    expect(get).toHaveBeenCalledOnce();
  });

  it('resolves when the request fails, leaves the signal empty, and tries again next time', async () => {
    answer = () => throwError(() => new Error('offline'));
    await expect(firstValueFrom(store.load())).resolves.toBeUndefined();
    expect(store.preferences()).toBeNull();

    answer = () => of(prefs(false));
    await firstValueFrom(store.load());
    expect(get).toHaveBeenCalledTimes(2);
    expect(store.preferences()).toEqual(prefs(false));
  });

  it('save() sends the PATCH and sets the signal from the response', async () => {
    await firstValueFrom(store.load());
    const saved = await firstValueFrom(store.save({ pages: { explore: false } }));
    expect(update).toHaveBeenCalledWith({ pages: { explore: false } });
    expect(saved).toEqual(prefs(false));
    expect(store.preferences()).toEqual(prefs(false));
  });

  it('save() passes errors on and keeps the previous preferences', async () => {
    await firstValueFrom(store.load());
    patch = () => throwError(() => new Error('nope'));
    await expect(firstValueFrom(store.save({ pages: { explore: false } }))).rejects.toThrow('nope');
    expect(store.preferences()).toEqual(prefs());
  });
});
