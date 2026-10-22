import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Profile, ResumeResponse, Skill } from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { ContentApi, CrudApi, apiErrorMessage } from './content-api.service';
import { HttpErrorResponse } from '@angular/common/http';

describe('ContentApi', () => {
  let api: ContentApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ContentApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the public resume from GET /api/resume', async () => {
    const result = firstValueFrom(api.resume());
    const body = {
      profile: null,
      experiences: [],
      education: [],
      skills: [],
      projects: [],
    } satisfies ResumeResponse;
    http.expectOne({ method: 'GET', url: '/api/resume' }).flush(body);
    expect(await result).toEqual(body);
  });

  it('loads the admin profile, and returns null when none exists yet (404)', async () => {
    const result = firstValueFrom(api.profile());
    http
      .expectOne({ method: 'GET', url: '/api/profile' })
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(await result).toBeNull();
  });

  it('saves the profile with PUT /api/profile', async () => {
    const profile = { fullName: 'P' } as Profile;
    const result = firstValueFrom(api.saveProfile(profile));
    const req = http.expectOne({ method: 'PUT', url: '/api/profile' });
    expect(req.request.body).toBe(profile);
    req.flush(profile);
    expect(await result).toBe(profile);
  });

  it.each([
    ['skills', '/api/skills'],
    ['experiences', '/api/experiences'],
    ['education', '/api/education'],
    ['projects', '/api/projects'],
  ] as const)('maps the %s operations to %s', (resource, base) => {
    const crud = api[resource] as CrudApi<unknown, unknown, unknown>;
    crud.list().subscribe();
    http.expectOne({ method: 'GET', url: base }).flush([]);

    crud.create({} as never).subscribe();
    http.expectOne({ method: 'POST', url: base }).flush({});

    crud.update('id-1', { sortOrder: 1 } as never).subscribe();
    const patch = http.expectOne({ method: 'PATCH', url: `${base}/id-1` });
    expect(patch.request.body).toEqual({ sortOrder: 1 });
    patch.flush({});

    crud.remove('id-1').subscribe();
    http
      .expectOne({ method: 'DELETE', url: `${base}/id-1` })
      .flush(null, { status: 204, statusText: 'No Content' });

    crud.reorder(['b', 'a']).subscribe();
    const order = http.expectOne({ method: 'PUT', url: `${base}/order` });
    expect(order.request.body).toEqual({ ids: ['b', 'a'] });
    order.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('types the skills list', async () => {
    const skills: Skill[] = [
      { id: 's', name: 'Angular', slug: 'angular', category: 'Core', level: 5, sortOrder: 0 },
    ];
    const result = firstValueFrom(api.skills.list());
    http.expectOne('/api/skills').flush(skills);
    expect((await result)[0].name).toBe('Angular');
  });
});

describe('apiErrorMessage', () => {
  it.each([
    [
      new HttpErrorResponse({
        status: 400,
        error: { message: ['name must be a string', 'level must not be greater than 5'] },
      }),
      'name must be a string. level must not be greater than 5.',
    ],
    [
      new HttpErrorResponse({
        status: 409,
        error: { message: 'A skill named "Angular" already exists' },
      }),
      'A skill named "Angular" already exists.',
    ],
    [
      new HttpErrorResponse({ status: 404, error: { message: 'Skill x not found' } }),
      'Skill x not found.',
    ],
    [new HttpErrorResponse({ status: 0 }), 'The server could not be reached. Please try again.'],
    [new HttpErrorResponse({ status: 500 }), 'Something went wrong. Please try again.'],
    [new Error('boom'), 'Something went wrong. Please try again.'],
  ])('turns API errors into a readable message (%#)', (error, message) => {
    expect(apiErrorMessage(error)).toBe(message);
  });
});
