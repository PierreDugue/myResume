import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SitePreferences } from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { PreferencesApi } from './preferences-api.service';

const all = (visible: boolean): SitePreferences['pages'] => ({
  overview: visible,
  explore: visible,
  traces: visible,
  serviceMap: visible,
  quality: visible,
  about: visible,
});

describe('PreferencesApi', () => {
  let http: HttpTestingController;
  let api: PreferencesApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(PreferencesApi);
  });

  afterEach(() => http.verify());

  it('loads the preferences with GET /api/preferences', async () => {
    const result = firstValueFrom(api.get());
    const req = http.expectOne('/api/preferences');
    expect(req.request.method).toBe('GET');
    req.flush({ pages: all(true), overview: { skillsOverTime: [] } });
    expect(await result).toEqual({ pages: all(true), overview: { skillsOverTime: [] } });
  });

  it('sends only what changed with PATCH /api/preferences and returns the full preferences', async () => {
    const result = firstValueFrom(api.update({ pages: { explore: false } }));
    const req = http.expectOne('/api/preferences');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ pages: { explore: false } });
    req.flush({ pages: { ...all(true), explore: false }, overview: { skillsOverTime: [] } });
    expect((await result).pages.explore).toBe(false);
  });

  it('lets errors through', async () => {
    const result = firstValueFrom(api.get());
    http.expectOne('/api/preferences').flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(result).rejects.toMatchObject({ status: 500 });
  });
});
