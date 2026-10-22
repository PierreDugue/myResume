import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type {
  CreateEducationRequest,
  CreateExperienceRequest,
  CreateProjectRequest,
  CreateSkillRequest,
  Education,
  Experience,
  Profile,
  Project,
  ResumeResponse,
  Skill,
  UpdateEducationRequest,
  UpdateExperienceRequest,
  UpdateProjectRequest,
  UpdateSkillRequest,
} from '@my-resume/api-models';
import { Observable, catchError, of, throwError } from 'rxjs';

/** The list operations every content resource offers (docs/api-contract.md, Content). */
export interface CrudApi<T, C, U> {
  list(): Observable<T[]>;
  create(body: C): Observable<T>;
  update(id: string, body: U): Observable<T>;
  remove(id: string): Observable<void>;
  reorder(ids: string[]): Observable<void>;
}

function crud<T, C, U>(http: HttpClient, base: string): CrudApi<T, C, U> {
  return {
    list: () => http.get<T[]>(base),
    create: (body) => http.post<T>(base, body),
    update: (id, body) => http.patch<T>(`${base}/${id}`, body),
    remove: (id) => http.delete<void>(`${base}/${id}`),
    reorder: (ids) => http.put<void>(`${base}/order`, { ids }),
  };
}

/** Typed access to the resume content API. */
@Service()
export class ContentApi {
  private readonly http = inject(HttpClient);

  readonly skills = crud<Skill, CreateSkillRequest, UpdateSkillRequest>(this.http, '/api/skills');
  readonly experiences = crud<Experience, CreateExperienceRequest, UpdateExperienceRequest>(
    this.http,
    '/api/experiences',
  );
  readonly education = crud<Education, CreateEducationRequest, UpdateEducationRequest>(
    this.http,
    '/api/education',
  );
  readonly projects = crud<Project, CreateProjectRequest, UpdateProjectRequest>(
    this.http,
    '/api/projects',
  );

  /** Public: everything the plain view and dashboards show. */
  resume(): Observable<ResumeResponse> {
    return this.http.get<ResumeResponse>('/api/resume');
  }

  /** Admin: the full profile, or null when none exists yet. */
  profile(): Observable<Profile | null> {
    return this.http
      .get<Profile>('/api/profile')
      .pipe(
        catchError((e: unknown) =>
          e instanceof HttpErrorResponse && e.status === 404 ? of(null) : throwError(() => e),
        ),
      );
  }

  saveProfile(profile: Profile): Observable<Profile> {
    return this.http.put<Profile>('/api/profile', profile);
  }
}

/** A readable sentence from an API error (Nest's `{ message: string | string[] }`). */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'The server could not be reached. Please try again.';
    const message = (error.error as { message?: unknown } | null)?.message;
    const parts = Array.isArray(message) ? message : typeof message === 'string' ? [message] : [];
    if (parts.length > 0 && error.status < 500) {
      return parts.map((p) => (String(p).endsWith('.') ? String(p) : `${p}.`)).join(' ');
    }
  }
  return 'Something went wrong. Please try again.';
}
