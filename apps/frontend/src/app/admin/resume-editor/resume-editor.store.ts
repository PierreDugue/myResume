import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
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
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  defer,
  forkJoin,
  ignoreElements,
  map,
  of,
  tap,
  throwError,
} from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ContentApi, CrudApi } from '../../core/content/content-api.service';
import type { ResumeSectionKind } from '../../public/plain-resume/resume-edit-slots';
import { moveItem } from './reorder';

/** Everything the editor shows, as the admin endpoints return it (the full profile included). */
export interface EditableResume {
  profile: Profile | null;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}

export interface EntityOf {
  experience: Experience;
  education: Education;
  project: Project;
  skill: Skill;
}
export interface CreateOf {
  experience: CreateExperienceRequest;
  education: CreateEducationRequest;
  project: CreateProjectRequest;
  skill: CreateSkillRequest;
}
export interface UpdateOf {
  experience: UpdateExperienceRequest;
  education: UpdateEducationRequest;
  project: UpdateProjectRequest;
  skill: UpdateSkillRequest;
}

/** Each section kind, with its list in the state and its resource in `ContentApi`. */
const RESOURCES = {
  experience: 'experiences',
  education: 'education',
  project: 'projects',
  skill: 'skills',
} as const satisfies Record<ResumeSectionKind, keyof EditableResume & keyof ContentApi>;

type ListOf<K extends ResumeSectionKind> = EntityOf[K][];

/** Skills move within their category; the other lists move as a whole. */
const groupOf = (kind: ResumeSectionKind) =>
  kind === 'skill' ? (item: { id: string }) => (item as Skill).category : undefined;

const bySortOrder = <T extends { sortOrder: number }>(items: T[]) =>
  [...items].sort((a, b) => a.sortOrder - b.sortOrder);

/** A write whose request is only built when its turn in the queue comes. */
type Job = Observable<never>;

/**
 * The resume being edited in `/admin/resume`, kept in sync with the admin API. Writes update the
 * state from the server's answer (no optimistic updates) and run one at a time, in the order they
 * were started: each request is built at its turn, from the state the previous answer left, so
 * two quick edits never overwrite each other. Provided by `ResumeEditorPage`.
 */
@Service({ autoProvided: false })
export class ResumeEditorStore {
  private readonly api = inject(ContentApi);
  private readonly auth = inject(AuthService);
  private readonly state = signal<EditableResume | null>(null);
  private readonly jobs = new Subject<Job>();
  /** Set when the page is left: no new write can be queued. */
  private closed = false;

  /** The editable resume, or null until it is loaded. */
  readonly resume = this.state.asReadonly();

  /** What the plain view shows: the phone only when the profile shows it, as on `/resume`. */
  readonly view = computed<ResumeResponse | null>(() => {
    const r = this.state();
    if (!r) return null;
    const { profile, ...lists } = r;
    if (!profile) return { ...lists, profile: null };
    const { showPhone, ...visible } = profile;
    return { ...lists, profile: { ...visible, phone: showPhone ? visible.phone : null } };
  });

  constructor() {
    // A failed job is swallowed here (its caller already got the error), so the next one still runs.
    this.jobs.pipe(concatMap((job) => job.pipe(catchError(() => EMPTY)))).subscribe();
    // Leaving the page closes the queue without cancelling it: the writes already queued still
    // run, in order (the one in flight included), then the subscription ends by itself.
    inject(DestroyRef).onDestroy(() => {
      this.closed = true;
      this.jobs.complete();
    });
  }

  /** Loads everything (never from the cached `/api/resume`, which hides the phone). */
  load(): Observable<void> {
    return forkJoin({
      profile: this.api.profile(),
      experiences: this.api.experiences.list(),
      education: this.api.education.list(),
      skills: this.api.skills.list(),
      projects: this.api.projects.list(),
    }).pipe(
      map((r) => {
        this.state.set({
          profile: r.profile,
          experiences: bySortOrder(r.experiences),
          education: bySortOrder(r.education),
          skills: bySortOrder(r.skills),
          projects: bySortOrder(r.projects),
        });
      }),
    );
  }

  list<K extends ResumeSectionKind>(kind: K): ListOf<K> {
    return (this.state()?.[RESOURCES[kind]] ?? []) as ListOf<K>;
  }

  find<K extends ResumeSectionKind>(kind: K, id: string): EntityOf[K] | undefined {
    return this.list(kind).find((item) => item.id === id);
  }

  /** Replaces the whole profile (PUT; there is no profile PATCH) with `change(current profile)`. */
  saveProfile(change: (current: Profile) => Profile): Observable<Profile> {
    return this.enqueue(() => {
      const current = this.state()?.profile;
      if (!current) return throwError(() => new Error('There is no profile to save.'));
      return this.api
        .saveProfile(change(current))
        .pipe(tap((saved) => this.patchState((r) => ({ ...r, profile: saved }))));
    });
  }

  /** PATCHes an item with `build(current item)`; fails if the item is gone by then. */
  update<K extends ResumeSectionKind>(
    kind: K,
    id: string,
    build: (current: EntityOf[K]) => UpdateOf[K],
  ): Observable<EntityOf[K]> {
    return this.enqueue(() => {
      const current = this.find(kind, id);
      if (!current) return throwError(() => new Error(`No ${kind} ${id} to update.`));
      return this.crud(kind)
        .update(id, build(current))
        .pipe(
          tap((saved) =>
            this.setList(kind, (items) => items.map((item) => (item.id === id ? saved : item))),
          ),
        );
    });
  }

  /** Creates an item at the end of its list. */
  create<K extends ResumeSectionKind>(kind: K, body: CreateOf[K]): Observable<EntityOf[K]> {
    return this.enqueue(() =>
      this.crud(kind)
        .create(body)
        .pipe(tap((saved) => this.setList(kind, (items) => [...items, saved]))),
    );
  }

  remove(kind: ResumeSectionKind, id: string): Observable<void> {
    return this.enqueue(() =>
      this.crud(kind)
        .remove(id)
        .pipe(
          tap(() => {
            this.setList(kind, (items) => items.filter((item) => item.id !== id));
            if (kind === 'skill') this.forgetSkill(id);
          }),
        ),
    );
  }

  /** Whether `move(kind, id, delta)` would do anything now. */
  canMove(kind: ResumeSectionKind, id: string, delta: -1 | 1): boolean {
    return moveItem(this.list(kind), id, delta, groupOf(kind)) !== null;
  }

  /**
   * Moves an item one step (skills within their category), once the server accepted it. The new
   * order is computed at the write's turn; nothing is sent if the item can no longer move.
   */
  move(kind: ResumeSectionKind, id: string, delta: -1 | 1): Observable<void> {
    return this.enqueue(() => {
      const ids = moveItem(this.list(kind), id, delta, groupOf(kind));
      if (!ids) return of(undefined);
      return this.crud(kind)
        .reorder(ids)
        .pipe(
          tap(() =>
            this.setList(kind, (items) => {
              const byId = new Map(items.map((item) => [item.id, item]));
              return ids.flatMap((i) => byId.get(i) ?? []);
            }),
          ),
        );
    });
  }

  /**
   * Queues `write` when the returned observable is subscribed to, and replays its outcome (value,
   * completion or error) to that subscriber only. The job feeds a Subject: unsubscribing just
   * stops listening, the write still runs in its place in the queue. Fails once the page is left.
   * A write whose turn comes after the session ended is not sent: it fails with 'Signed out'
   * (a request without a token would only get a 401 and send the visitor to the login page).
   */
  private enqueue<T>(write: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (this.closed) {
        subscriber.error(new Error('The resume editor is closed.'));
        return;
      }
      const outcome = new Subject<T>();
      const listening = outcome.subscribe(subscriber);
      // Not `tap(outcome)`: tap would take the Subject's own `subscribe` for its subscribe callback.
      const report = {
        next: (value: T) => outcome.next(value),
        error: (e: unknown) => outcome.error(e),
        complete: () => outcome.complete(),
      };
      const start = () =>
        this.auth.isAuthenticated() ? write() : throwError(() => new Error('Signed out'));
      this.jobs.next(defer(start).pipe(tap(report), ignoreElements()));
      return listening;
    });
  }

  private crud<K extends ResumeSectionKind>(kind: K) {
    return this.api[RESOURCES[kind]] as unknown as CrudApi<EntityOf[K], CreateOf[K], UpdateOf[K]>;
  }

  private setList<K extends ResumeSectionKind>(
    kind: K,
    change: (items: ListOf<K>) => ListOf<K>,
  ): void {
    this.patchState((r) => ({ ...r, [RESOURCES[kind]]: change(r[RESOURCES[kind]] as ListOf<K>) }));
  }

  private patchState(change: (r: EditableResume) => EditableResume): void {
    this.state.update((r) => (r ? change(r) : r));
  }

  /** A deleted skill leaves every tech stack, so a later PATCH can't send its id. */
  private forgetSkill(skillId: string): void {
    const without = <T extends { skillIds: string[] }>(item: T): T =>
      item.skillIds.includes(skillId)
        ? { ...item, skillIds: item.skillIds.filter((s) => s !== skillId) }
        : item;
    this.patchState((r) => ({
      ...r,
      experiences: r.experiences.map((e) => ({
        ...without(e),
        highlights: e.highlights.map(without),
      })),
      projects: r.projects.map((p) => ({ ...without(p), spans: p.spans.map(without) })),
    }));
  }
}
