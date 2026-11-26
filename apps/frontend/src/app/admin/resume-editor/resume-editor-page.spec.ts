import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import type { HighlightInput, Profile, Skill } from '@my-resume/api-models';
import { Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { esil, kx, profile, site, skills, whoz } from '../testing/fixtures';
import { field, renderRoute, type } from '../testing/render';
import { ResumeEditorPage } from './resume-editor-page';

@Component({ template: 'public resume' })
class PublicResume {}

@Component({ selector: 'app-test-admin-home', template: 'admin home' })
class AdminHome {}

// ---------------------------------------------------------------------------------------------
// A tiny in-memory API, so the page sees what a real server would answer.
// ---------------------------------------------------------------------------------------------

type Resource = 'skills' | 'experiences' | 'education' | 'projects';
type Entity = { id: string; sortOrder: number } & Record<string, unknown>;
type Body = Record<string, unknown>;
type Reply = Observable<unknown>;

/** The admin's profile: the phone is set but hidden (`showPhone: false`). */
const adminProfile: Profile = { ...profile, phone: '+33 6 00 00 00 00', showPhone: false };
const rxjs: Skill = {
  id: 's-rxjs',
  name: 'RxJS',
  slug: 'rxjs',
  category: 'Core Frameworks',
  level: null,
  sortOrder: 3,
};

let server: { profile: Profile | null; lists: Record<Resource, Entity[]> };
let nextId: number;

const seed = () => {
  nextId = 1;
  server = structuredClone({
    profile: adminProfile,
    lists: {
      skills: skills as unknown as Entity[],
      experiences: [whoz, kx] as unknown as Entity[],
      education: [esil] as unknown as Entity[],
      projects: [site] as unknown as Entity[],
    },
  });
};

const CREATE_DEFAULTS: Record<Resource, Body> = {
  skills: { slug: 'a-skill', level: null },
  experiences: { location: null, endDate: null, summary: null, skillIds: [], highlights: [] },
  education: { field: null, location: null, endDate: null, description: null },
  projects: {
    slug: 'a-project',
    url: null,
    repoUrl: null,
    imageUrl: null,
    startDate: null,
    endDate: null,
    skillIds: [],
    spans: [],
  },
};

/** What the server stores for the highlights a PATCH/POST sends. */
function toHighlights(inputs: HighlightInput[]) {
  return inputs.map((h, i) => ({
    id: h.id ?? `h-new-${nextId++}`,
    date: h.date,
    level: h.level,
    message: h.message,
    impact: h.impact ?? null,
    labels: h.labels ?? {},
    skillIds: h.skillIds ?? [],
    sortOrder: i,
  }));
}

function withHighlights(body: Body): Body {
  return body['highlights']
    ? { ...body, highlights: toHighlights(body['highlights'] as HighlightInput[]) }
    : body;
}

function serverCreate(key: Resource, body: Body): Entity {
  const entity = {
    ...CREATE_DEFAULTS[key],
    ...withHighlights(body),
    id: `new-${nextId++}`,
    sortOrder: server.lists[key].length,
  };
  server.lists[key].push(entity);
  return structuredClone(entity);
}

function serverUpdate(key: Resource, id: string, body: Body): Entity {
  const list = server.lists[key];
  const index = list.findIndex((e) => e.id === id);
  list[index] = { ...list[index], ...withHighlights(body) };
  return structuredClone(list[index]);
}

function serverRemove(key: Resource, id: string): void {
  server.lists[key] = server.lists[key].filter((e) => e.id !== id);
}

function serverReorder(key: Resource, ids: string[]): void {
  const byId = new Map(server.lists[key].map((e) => [e.id, e]));
  server.lists[key] = ids.map((id, i) => ({ ...(byId.get(id) as Entity), sortOrder: i }));
}

function crud(key: Resource) {
  return {
    list: vi.fn((): Reply => of(structuredClone(server.lists[key]))),
    create: vi.fn((body: Body): Reply => of(serverCreate(key, body))),
    update: vi.fn((id: string, body: Body): Reply => of(serverUpdate(key, id, body))),
    remove: vi.fn((id: string): Reply => {
      serverRemove(key, id);
      return of(undefined);
    }),
    reorder: vi.fn((ids: string[]): Reply => {
      serverReorder(key, ids);
      return of(undefined);
    }),
  };
}

let api: ReturnType<typeof buildApi>;
function buildApi() {
  return {
    profile: vi.fn((): Reply => of(structuredClone(server.profile))),
    saveProfile: vi.fn((p: Profile): Reply => {
      server.profile = structuredClone(p);
      return of(structuredClone(p));
    }),
    skills: crud('skills'),
    experiences: crud('experiences'),
    education: crud('education'),
    projects: crud('projects'),
  };
}

const badRequest = (...messages: string[]) =>
  throwError(() => new HttpErrorResponse({ status: 400, error: { message: messages } }));

// ---------------------------------------------------------------------------------------------
// Helpers to drive the page like a user
// ---------------------------------------------------------------------------------------------

let el: HTMLElement;
let settle: () => Promise<void>;
/** The owner's session: the editor is an admin page, always reached signed in. */
let isAuthenticated: WritableSignal<boolean>;

async function start() {
  const rendered = await renderRoute(
    '/admin/resume',
    [
      { path: 'admin/resume', component: ResumeEditorPage },
      { path: 'resume', component: PublicResume },
    ],
    [
      { provide: ContentApi, useValue: api },
      { provide: AuthService, useValue: { isAuthenticated } },
    ],
  );
  el = rendered.el;
  settle = rendered.settle;
}

/** The text a sighted user reads on a button: without the visually hidden prefix. */
function visible(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll('.sr-only').forEach((n) => n.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The button of an editable text: its accessible name starts with "Edit <label>: ". */
function inline(scope: ParentNode, label: string, value?: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button.inline-text')].find(
    (b) =>
      (b.textContent ?? '').trim().startsWith(`Edit ${label}:`) &&
      (value === undefined || visible(b) === value),
  );
  if (!found) throw new Error(`No editable "${label}"${value === undefined ? '' : ` "${value}"`}`);
  return found;
}

const fieldIn = (scope: ParentNode, label: string) =>
  $<HTMLInputElement | HTMLTextAreaElement>(
    scope,
    `input[aria-label="${label}"], textarea[aria-label="${label}"]`,
  );

/** Clicks an editable text and returns the field that opens. */
async function open(scope: ParentNode, label: string, value?: string) {
  inline(scope, label, value).click();
  await settle();
  return fieldIn(scope, label);
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

type SaveWith = 'enter' | 'ctrl' | 'meta' | 'blur';

/** Types a value and saves it the way the user chose. */
async function write(input: HTMLInputElement | HTMLTextAreaElement, text: string, how: SaveWith) {
  type(input, text);
  await settle();
  if (how === 'blur') {
    input.focus();
    input.blur();
  } else {
    press(
      input,
      'Enter',
      how === 'ctrl' ? { ctrlKey: true } : how === 'meta' ? { metaKey: true } : {},
    );
  }
  await settle();
}

/** Like `start()`, with a second admin route to navigate to (leaving the editor page). */
async function startWithAdminRoute() {
  const rendered = await renderRoute(
    '/admin/resume',
    [
      { path: 'admin/resume', component: ResumeEditorPage },
      { path: 'admin', component: AdminHome },
      { path: 'resume', component: PublicResume },
    ],
    [
      { provide: ContentApi, useValue: api },
      { provide: AuthService, useValue: { isAuthenticated } },
    ],
  );
  el = rendered.el;
  settle = rendered.settle;
  return rendered;
}

const texts = (selector: string) =>
  [...el.querySelectorAll(selector)].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
const statuses = () => texts('span.save-status[role="status"]').filter(Boolean);
const fieldErrors = () => texts('.field-error').filter(Boolean);
const formAlerts = () => texts('p.form-error[role="alert"]').filter(Boolean);

const header = () => $(el, 'header.resume-header');
const jobs = () => [...el.querySelectorAll<HTMLElement>('section.experience article')];
function job(n: number): HTMLElement {
  const found = jobs()[n];
  if (!found) throw new Error(`No experience #${n + 1} (found ${jobs().length})`);
  return found;
}
const companies = () => jobs().map((j) => visible(inline(j, 'Company')));
const projectArticle = () => $(el, 'section.projects article');
const educationArticle = () => $(el, 'section.education article');
const skillsSection = () => $(el, 'section.skills');
function highlight(jobN: number, n: number): HTMLElement {
  const found = job(jobN).querySelectorAll<HTMLElement>('li.highlight')[n];
  if (!found) throw new Error(`No achievement #${n + 1} in experience #${jobN + 1}`);
  return found;
}

const tool = (label: string) => $<HTMLButtonElement>(el, `[aria-label='${label}']`);
const hasTool = (label: string) => el.querySelector(`[aria-label='${label}']`) !== null;
const smallForm = () => $(el, 'form.small-form');

function buttonNamed(scope: ParentNode, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`No button "${text}"`);
  return found;
}

async function click(button: HTMLElement) {
  button.click();
  await settle();
}

describe('ResumeEditorPage', () => {
  beforeEach(() => {
    seed();
    api = buildApi();
    isAuthenticated = signal(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('loading', () => {
    it('shows the profile, skills and interests as the plain view lays them out', async () => {
      await start();
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
      expect(visible(inline(header(), 'Headline'))).toBe(
        'Senior Front-End Engineer | Angular Specialist',
      );
      expect(visible(inline(header(), 'Email'))).toBe('pierre@example.com');
      expect(visible(inline(header(), 'Location'))).toBe('Nice, France');
      expect(visible(inline(header(), 'Summary'))).toBe('Senior Angular developer.');
      expect($(header(), 'a[href="https://www.linkedin.com/in/example"]').textContent).toContain(
        'LinkedIn',
      );

      expect(texts('section.skills dt')).toEqual([
        'Core Frameworks',
        'State & Reactive',
        'Testing & Tools',
      ]);
      expect(
        [...skillsSection().querySelectorAll('dd')].map((dd) => visible(inline(dd, 'Name'))),
      ).toEqual(['Angular', 'NgRx', 'Jest']);
      expect(visible(inline($(el, 'section.interests'), 'Interests'))).toBe(
        'Guitar and photography.',
      );
    });

    it('lists the experiences in order, with their texts, achievements, period and tech stack', async () => {
      await start();
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
      expect(visible(inline(job(1), 'Location'))).toBe('Full Remote');
      expect(visible(inline(job(1), 'Summary'))).toBe(
        'Led front-end development of a data visualization platform.',
      );
      expect(
        [...job(1).querySelectorAll('li.highlight')].map((li) =>
          visible(inline(li, 'Achievement')),
        ),
      ).toEqual(['Cut average page load time by 35%.', 'Introduced an NX monorepo.']);
      expect($(job(1), '.meta').textContent).toContain('Sep 2022 – Nov 2025');
      expect($(job(0), '.meta').textContent).toContain('May 2026 – Present');
      expect($(job(1), '.stack').textContent).toMatch(/Angular, NgRx/);
    });

    it('invites the owner to fill in an empty optional text', async () => {
      await start();
      const summary = inline(job(0), 'Summary');
      expect(visible(summary)).toBe('Add summary');
      expect(visible(inline(educationArticle(), 'Description'))).toBe('Add description');
    });

    it('shows the projects and the education', async () => {
      await start();
      expect(visible(inline(projectArticle(), 'Title'))).toBe('Pierre O11y');
      expect(visible(inline(projectArticle(), 'Description'))).toBe('This site.');
      expect(visible(inline(educationArticle(), 'School'))).toBe('ESIL');
      expect(visible(inline(educationArticle(), 'Degree'))).toBe("Diplôme d'ingénieur");
      expect(visible(inline(educationArticle(), 'Field'))).toBe('Computer Science');
      expect(visible(inline(educationArticle(), 'Location'))).toBe('Marseille, France');
      expect($(educationArticle(), '.meta').textContent).toContain('Sep 2008 – Jun 2011');
    });

    it('keeps the phone hidden when the profile does not show it', async () => {
      await start();
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
      expect(el.textContent).not.toContain('+33 6 00 00 00 00');
      expect(() => inline(header(), 'Phone')).toThrow();
    });

    it('shows the phone, editable, when the profile shows it', async () => {
      server.profile = { ...adminProfile, showPhone: true };
      await start();
      expect(visible(inline(header(), 'Phone'))).toBe('+33 6 00 00 00 00');
    });

    it('links back to the public resume', async () => {
      await start();
      const link = [...el.querySelectorAll('a')].find(
        (a) => a.textContent?.trim() === 'View public resume',
      );
      expect(link?.getAttribute('href')).toBe('/resume');
    });

    it('shows Loading… until the content arrives', async () => {
      const profileReply = new Subject<Profile | null>();
      api.profile.mockReturnValueOnce(profileReply);
      await start();
      expect(el.textContent).toContain('Loading…');
      expect(el.querySelector('header.resume-header')).toBeNull();

      profileReply.next(structuredClone(adminProfile));
      profileReply.complete();
      await settle();
      expect(el.textContent).not.toContain('Loading…');
      expect(visible(inline(header(), 'Full name'))).toBe('Pierre Dugue');
    });

    it('shows a retry button when the content cannot be loaded, and loads it again on retry', async () => {
      api.experiences.list.mockReturnValueOnce(throwError(() => new Error('offline')));
      await start();
      expect(el.querySelector('section.experience')).toBeNull();

      await click($(el, 'button.retry'));
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(el.querySelector('button.retry')).toBeNull();
    });
  });

  describe('editing a text in place', () => {
    it('opens a field with the text, focused, and saves it with Enter as a PATCH of that key only', async () => {
      await start();
      const input = await open(job(1), 'Role');
      expect(input.tagName).toBe('INPUT');
      expect(input.value).toBe('Angular Front-End Engineer');
      expect(document.activeElement).toBe(input);

      await write(input, 'Lead Engineer', 'enter');

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
      expect(statuses()).toEqual(['Saved']);
      expect(job(1).querySelector('input, textarea')).toBeNull();
      const text = inline(job(1), 'Role');
      expect(visible(text)).toBe('Lead Engineer');
      expect(document.activeElement).toBe(text);
      expect(visible(inline(job(0), 'Role'))).toBe('Angular Front-End Engineer');
    });

    it('cancels with Escape: no request, the old text back, focus on the text button', async () => {
      await start();
      const input = await open(job(1), 'Role');
      type(input, 'Changed my mind');
      press(input, 'Escape');
      await settle();

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).querySelector('input, textarea')).toBeNull();
      const text = inline(job(1), 'Role');
      expect(visible(text)).toBe('Angular Front-End Engineer');
      expect(document.activeElement).toBe(text);

      // the abandoned text is not remembered
      expect((await open(job(1), 'Role')).value).toBe('Angular Front-End Engineer');
    });

    it('saves when the field loses focus', async () => {
      await start();
      await write(await open(job(1), 'Role'), 'Principal Engineer', 'blur');

      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Principal Engineer' });
      expect(visible(inline(job(1), 'Role'))).toBe('Principal Engineer');
    });

    it.each<[string, SaveWith]>([
      ['Enter', 'enter'],
      ['blur', 'blur'],
    ])('sends nothing and just closes when %s leaves the text unchanged', async (_name, how) => {
      await start();
      const input = await open(job(1), 'Role');
      await write(input, 'Angular Front-End Engineer', how);

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).querySelector('input, textarea')).toBeNull();
      expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
    });

    it('edits a long text in a text area where Enter adds a line instead of saving', async () => {
      await start();
      const area = await open(job(1), 'Summary');
      expect(area.tagName).toBe('TEXTAREA');
      type(area, 'Line one\nLine two');
      press(area, 'Enter');
      await settle();

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(job(1).contains(area)).toBe(true);
    });

    it.each<[string, SaveWith]>([
      ['Ctrl+Enter', 'ctrl'],
      ['Cmd+Enter', 'meta'],
    ])('saves a text area with %s, keeping its line breaks', async (_name, how) => {
      await start();
      await write(await open(job(1), 'Summary'), 'Line one\nLine two', how);

      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
        summary: 'Line one\nLine two',
      });
      expect(statuses()).toEqual(['Saved']);
    });

    it('fills an empty optional text, which shows an "Add" prompt', async () => {
      await start();
      const input = await open(job(0), 'Summary');
      expect(input.value).toBe('');
      await write(input, 'Building a skills platform.', 'ctrl');

      expect(api.experiences.update).toHaveBeenCalledWith('e-whoz', {
        summary: 'Building a skills platform.',
      });
      expect(visible(inline(job(0), 'Summary'))).toBe('Building a skills platform.');
    });

    it('shows "Saving…" while the request is pending, then "Saved"', async () => {
      const pending = new Subject<unknown>();
      api.experiences.update.mockReturnValueOnce(pending);
      await start();
      await write(await open(job(1), 'Role'), 'Lead', 'enter');
      expect(statuses()).toEqual(['Saving…']);

      pending.next(serverUpdate('experiences', 'e-kx', { role: 'Lead' }));
      pending.complete();
      await settle();
      expect(statuses()).toEqual(['Saved']);
      expect(visible(inline(job(1), 'Role'))).toBe('Lead');
    });

    it('shows the API error under the field, keeps what was typed, and saves once corrected', async () => {
      api.experiences.update.mockReturnValueOnce(
        badRequest('role must be shorter than or equal to 120 characters'),
      );
      await start();
      const input = await open(job(1), 'Role');
      await write(input, 'Too much', 'enter');

      expect(fieldErrors()).toEqual(['role must be shorter than or equal to 120 characters.']);
      expect(statuses()).toEqual(['Not saved']);
      expect(fieldIn(job(1), 'Role').value).toBe('Too much');

      await write(fieldIn(job(1), 'Role'), 'Fine', 'enter');
      expect(api.experiences.update).toHaveBeenLastCalledWith('e-kx', { role: 'Fine' });
      expect(fieldErrors()).toEqual([]);
      expect(statuses()).toEqual(['Saved']);
    });

    describe('with the rules of the section screens', () => {
      const cases: {
        name: string;
        scope: () => ParentNode;
        label: string;
        current: string;
        typed: string;
        how: SaveWith;
        message: string;
      }[] = [
        {
          name: 'a role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: '',
          how: 'enter',
          message: 'Role is required',
        },
        {
          name: 'a 121-character role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: 'x'.repeat(121),
          how: 'enter',
          message: 'Use at most 120 characters',
        },
        {
          name: 'a company',
          scope: () => job(1),
          label: 'Company',
          current: 'KX',
          typed: '',
          how: 'enter',
          message: 'Company is required',
        },
        {
          name: 'an achievement',
          scope: () => highlight(1, 1),
          label: 'Achievement',
          current: 'Introduced an NX monorepo.',
          typed: '',
          how: 'ctrl',
          message: 'Describe the achievement',
        },
        {
          name: 'a school',
          scope: () => educationArticle(),
          label: 'School',
          current: 'ESIL',
          typed: '',
          how: 'enter',
          message: 'School is required',
        },
        {
          name: 'a degree',
          scope: () => educationArticle(),
          label: 'Degree',
          current: "Diplôme d'ingénieur",
          typed: '',
          how: 'enter',
          message: 'Degree is required',
        },
        {
          name: 'a project title',
          scope: () => projectArticle(),
          label: 'Title',
          current: 'Pierre O11y',
          typed: '',
          how: 'enter',
          message: 'Title is required',
        },
        {
          name: 'a project description',
          scope: () => projectArticle(),
          label: 'Description',
          current: 'This site.',
          typed: '',
          how: 'ctrl',
          message: 'Description is required',
        },
        {
          name: 'a skill name',
          scope: () => skillsSection(),
          label: 'Name',
          current: 'NgRx',
          typed: '',
          how: 'enter',
          message: 'Name is required',
        },
        {
          name: 'a full name',
          scope: () => header(),
          label: 'Full name',
          current: 'Pierre Dugue',
          typed: '',
          how: 'enter',
          message: 'Full name is required',
        },
        {
          name: 'an email address',
          scope: () => header(),
          label: 'Email',
          current: 'pierre@example.com',
          typed: 'not-an-email',
          how: 'enter',
          message: 'Enter a valid email address',
        },
        {
          name: 'a profile summary',
          scope: () => header(),
          label: 'Summary',
          current: 'Senior Angular developer.',
          typed: '',
          how: 'ctrl',
          message: 'Summary is required',
        },
      ];

      it.each(cases)(
        'refuses $name without sending anything, keeping the typed value',
        async ({ scope, label, current, typed, how, message }) => {
          await start();
          const input = await open(scope(), label, current);
          await write(input, typed, how);

          for (const call of [
            api.experiences.update,
            api.education.update,
            api.projects.update,
            api.skills.update,
            api.saveProfile,
          ]) {
            expect(call).not.toHaveBeenCalled();
          }
          expect(fieldErrors()).toEqual([message]);
          expect(statuses()).toEqual(['Not saved']);
          expect(fieldIn(scope(), label).value).toBe(typed);
        },
      );
    });

    describe('sends only the edited key, mapped like the section screens', () => {
      const cases: {
        name: string;
        scope: () => ParentNode;
        label: string;
        current: string;
        typed: string;
        how: SaveWith;
        resource: Resource;
        id: string;
        body: object;
      }[] = [
        {
          name: 'trims an experience role',
          scope: () => job(1),
          label: 'Role',
          current: 'Angular Front-End Engineer',
          typed: '  Lead  ',
          how: 'enter',
          resource: 'experiences',
          id: 'e-kx',
          body: { role: 'Lead' },
        },
        {
          name: 'clears an experience location to null',
          scope: () => job(1),
          label: 'Location',
          current: 'Full Remote',
          typed: '',
          how: 'enter',
          resource: 'experiences',
          id: 'e-kx',
          body: { location: null },
        },
        {
          name: 'edits an education degree',
          scope: () => educationArticle(),
          label: 'Degree',
          current: "Diplôme d'ingénieur",
          typed: 'MSc',
          how: 'enter',
          resource: 'education',
          id: 'ed-esil',
          body: { degree: 'MSc' },
        },
        {
          name: 'clears an education field to null',
          scope: () => educationArticle(),
          label: 'Field',
          current: 'Computer Science',
          typed: '',
          how: 'enter',
          resource: 'education',
          id: 'ed-esil',
          body: { field: null },
        },
        {
          name: 'edits a project title',
          scope: () => projectArticle(),
          label: 'Title',
          current: 'Pierre O11y',
          typed: 'Pierre Site',
          how: 'enter',
          resource: 'projects',
          id: 'p-site',
          body: { title: 'Pierre Site' },
        },
        {
          name: 'edits a project description',
          scope: () => projectArticle(),
          label: 'Description',
          current: 'This site.',
          typed: 'The resume as an observability platform.',
          how: 'ctrl',
          resource: 'projects',
          id: 'p-site',
          body: { description: 'The resume as an observability platform.' },
        },
        {
          name: 'renames a skill',
          scope: () => skillsSection(),
          label: 'Name',
          current: 'NgRx',
          typed: 'NgRx Store',
          how: 'enter',
          resource: 'skills',
          id: 's-ngrx',
          body: { name: 'NgRx Store' },
        },
      ];

      it.each(cases)('$name', async ({ scope, label, current, typed, how, resource, id, body }) => {
        await start();
        await write(await open(scope(), label, current), typed, how);

        expect(api[resource].update).toHaveBeenCalledTimes(1);
        expect(api[resource].update).toHaveBeenCalledWith(id, body);
        expect(statuses()).toEqual(['Saved']);
      });
    });

    describe('a highlight', () => {
      it('sends the complete list of achievements, each keeping its id and other details', async () => {
        await start();
        await write(
          await open(highlight(1, 1), 'Achievement'),
          'Introduced an Nx monorepo.',
          'ctrl',
        );

        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          highlights: [
            {
              id: 'h-1',
              date: '2025-11-30',
              level: 'achievement',
              message: 'Cut average page load time by 35%.',
              impact: kx.highlights[0].impact,
              labels: { team: 'platform' },
              skillIds: ['s-ngrx'],
            },
            {
              id: 'h-2',
              date: '2025-11-30',
              level: 'milestone',
              message: 'Introduced an Nx monorepo.',
              impact: null,
              labels: {},
              skillIds: [],
            },
          ],
        });
        expect(visible(inline(highlight(1, 1), 'Achievement'))).toBe('Introduced an Nx monorepo.');
      });

      it('builds each request from the latest saved content, not from what was open before', async () => {
        const firstSave = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(firstSave);
        await start();

        await write(await open(highlight(1, 0), 'Achievement'), 'First, edited', 'ctrl');
        expect(statuses()).toEqual(['Saving…']);

        // the second field is opened while the first save is still pending ...
        const second = await open(highlight(1, 1), 'Achievement');
        type(second, 'Second, edited');
        await settle();
        // ... and the first save is answered before the second one is sent
        const sent = api.experiences.update.mock.calls[0][1];
        firstSave.next(serverUpdate('experiences', 'e-kx', sent));
        firstSave.complete();
        await settle();
        press(second, 'Enter', { ctrlKey: true });
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(2);
        const messages = (
          api.experiences.update.mock.calls[1][1]['highlights'] as HighlightInput[]
        ).map((h) => h.message);
        expect(messages).toEqual(['First, edited', 'Second, edited']);
        expect(visible(inline(highlight(1, 0), 'Achievement'))).toBe('First, edited');
      });
    });

    describe('a profile text', () => {
      it('saves the whole profile, with the hidden phone and its visibility kept', async () => {
        await start();
        await write(await open(header(), 'Headline'), 'Lead Angular Engineer', 'enter');

        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(api.saveProfile).toHaveBeenCalledWith({
          ...adminProfile,
          headline: 'Lead Angular Engineer',
        });
        expect(visible(inline(header(), 'Headline'))).toBe('Lead Angular Engineer');
        expect(statuses()).toEqual(['Saved']);
      });

      it('clears an optional profile text to null', async () => {
        await start();
        await write(await open(header(), 'Location'), '', 'enter');

        expect(api.saveProfile).toHaveBeenCalledWith({ ...adminProfile, location: null });
        expect(visible(inline(header(), 'Location'))).toBe('Add location');
      });

      it('builds the request from the latest saved profile, not from what was open before', async () => {
        const firstSave = new Subject<unknown>();
        api.saveProfile.mockReturnValueOnce(firstSave);
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');

        const summary = await open(header(), 'Summary');
        type(summary, 'New summary');
        await settle();
        const sent = api.saveProfile.mock.calls[0][0];
        server.profile = sent;
        firstSave.next(structuredClone(sent));
        firstSave.complete();
        await settle();
        press(summary, 'Enter', { ctrlKey: true });
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          summary: 'New summary',
        });
      });
    });

    describe('leaving the field for another control', () => {
      const other = () => tool('Edit dates of "KX"');

      it('keeps focus on that control, and sends nothing, when the text is unchanged', async () => {
        await start();
        const input = await open(job(1), 'Role');
        input.focus();
        other().focus();
        await settle();

        expect(api.experiences.update).not.toHaveBeenCalled();
        expect(job(1).querySelector('input, textarea')).toBeNull();
        expect(visible(inline(job(1), 'Role'))).toBe('Angular Front-End Engineer');
        expect(document.activeElement).toBe(other());
      });

      it('saves a changed text and keeps focus on that control after "Saved"', async () => {
        await start();
        const input = await open(job(1), 'Role');
        type(input, 'Lead Engineer');
        await settle();
        input.focus();
        other().focus();
        await settle();

        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
        expect(statuses()).toEqual(['Saved']);
        expect(visible(inline(job(1), 'Role'))).toBe('Lead Engineer');
        expect(document.activeElement).toBe(other());
      });
    });

    describe('Escape while the save is pending', () => {
      it('leaves the field open, still saving, and still shows a later failure', async () => {
        const pending = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(pending);
        await start();
        const input = await open(job(1), 'Role');
        await write(input, 'Too much', 'enter');
        expect(statuses()).toEqual(['Saving…']);

        press(input, 'Escape');
        await settle();
        expect(job(1).contains(input)).toBe(true);
        expect(fieldIn(job(1), 'Role').value).toBe('Too much');
        expect(statuses()).toEqual(['Saving…']);

        pending.error(
          new HttpErrorResponse({
            status: 400,
            error: { message: ['role must be shorter than or equal to 120 characters'] },
          }),
        );
        await settle();
        expect(fieldIn(job(1), 'Role').value).toBe('Too much');
        expect(fieldErrors()).toEqual(['role must be shorter than or equal to 120 characters.']);
        expect(statuses()).toEqual(['Not saved']);
      });
    });

    describe('Enter while an input method is composing', () => {
      it.each<[string, string, KeyboardEventInit]>([
        ['an input', 'Role', {}],
        ['a text area, with Ctrl', 'Summary', { ctrlKey: true }],
      ])('does not save %s, and saves with the next Enter', async (_name, label, keys) => {
        await start();
        const input = await open(job(1), label);
        type(input, 'あいう');
        await settle();

        press(input, 'Enter', { ...keys, isComposing: true });
        await settle();
        expect(api.experiences.update).not.toHaveBeenCalled();
        expect(job(1).contains(input)).toBe(true);
        expect(statuses()).toEqual([]);

        press(input, 'Enter', keys);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(statuses()).toEqual(['Saved']);
      });

      /** Safari: the Enter that commits a composition has `isComposing: false` and keyCode 229. */
      const safariCommit = (keys: KeyboardEventInit) => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          keyCode: 229,
          bubbles: true,
          cancelable: true,
          ...keys,
        });
        if (event.keyCode !== 229) Object.defineProperty(event, 'keyCode', { value: 229 });
        return event;
      };

      it.each<[string, string, KeyboardEventInit]>([
        ['an input', 'Role', {}],
        ['a text area, with Ctrl', 'Summary', { ctrlKey: true }],
      ])(
        'does not save %s on the Enter that commits a composition in Safari (keyCode 229)',
        async (_name, label, keys) => {
          await start();
          const input = await open(job(1), label);
          type(input, 'あいう');
          await settle();

          input.dispatchEvent(safariCommit(keys));
          await settle();
          expect(api.experiences.update).not.toHaveBeenCalled();
          expect(job(1).contains(input)).toBe(true);
          expect(statuses()).toEqual([]);

          press(input, 'Enter', keys);
          await settle();
          expect(api.experiences.update).toHaveBeenCalledTimes(1);
          expect(statuses()).toEqual(['Saved']);
        },
      );
    });
  });

  describe('the dates form', () => {
    const datesOf = (title: string) => `Edit dates of "${title}"`;

    it('opens next to the item with the current dates, and closes with Cancel without a request', async () => {
      await start();
      const toggle = tool(datesOf('KX'));
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(field(smallForm(), 'Start date').value).toBe('2022-09-01');
      expect(field(smallForm(), 'End date').value).toBe('2025-11-30');

      type(field(smallForm(), 'End date'), '2024-01-01');
      await click(buttonNamed(smallForm(), 'Cancel'));
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(api.experiences.update).not.toHaveBeenCalled();

      await click(toggle);
      expect(field(smallForm(), 'End date').value).toBe('2025-11-30');
    });

    it.each([
      [
        'an end date before the start date',
        '2022-09-01',
        '2020-01-01',
        'The end date must be after the start date',
      ],
      ['no start date', '', '2025-11-30', 'Start date is required'],
    ])('refuses %s without sending anything', async (_name, from, to, message) => {
      await start();
      await click(tool(datesOf('KX')));
      type(field(smallForm(), 'Start date'), from);
      type(field(smallForm(), 'End date'), to);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([message]);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });

    it.each([
      {
        name: 'an experience, ending now',
        title: 'KX',
        start: '2022-09-01',
        end: '',
        resource: 'experiences' as const,
        id: 'e-kx',
        body: { startDate: '2022-09-01', endDate: null },
        article: () => job(1),
        period: 'Sep 2022 – Present',
      },
      {
        name: 'an education',
        title: 'ESIL',
        start: '2008-10-01',
        end: '2011-07-31',
        resource: 'education' as const,
        id: 'ed-esil',
        body: { startDate: '2008-10-01', endDate: '2011-07-31' },
        article: () => educationArticle(),
        period: 'Oct 2008 – Jul 2011',
      },
      {
        name: 'a project',
        title: 'Pierre O11y',
        start: '2026-10-01',
        end: '2026-12-31',
        resource: 'projects' as const,
        id: 'p-site',
        body: { startDate: '2026-10-01', endDate: '2026-12-31' },
        article: () => projectArticle(),
        period: 'Oct 2026 – Dec 2026',
      },
    ])('saves the dates of $name, an empty end date meaning current', async (c) => {
      await start();
      await click(tool(datesOf(c.title)));
      type(field(smallForm(), 'Start date'), c.start);
      type(field(smallForm(), 'End date'), c.end);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api[c.resource].update).toHaveBeenCalledTimes(1);
      expect(api[c.resource].update).toHaveBeenCalledWith(c.id, c.body);
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(c.article(), '.meta').textContent).toContain(c.period);
    });

    it('stays open with the API error when the dates are rejected', async () => {
      api.experiences.update.mockReturnValueOnce(badRequest('endDate must be a valid date'));
      await start();
      await click(tool(datesOf('KX')));
      type(field(smallForm(), 'End date'), '2025-12-31');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['endDate must be a valid date.']);
      expect(field(smallForm(), 'End date').value).toBe('2025-12-31');
    });
  });

  describe('the tech stack form', () => {
    const stackOf = (title: string) => `Edit tech stack of "${title}"`;
    const box = (id: string) =>
      $<HTMLInputElement>(smallForm(), `input[type="checkbox"][value="${id}"]`);

    it('offers every skill, checks the current stack, and saves the new one', async () => {
      await start();
      await click(tool(stackOf('KX')));
      expect(box('s-angular').checked).toBe(true);
      expect(box('s-ngrx').checked).toBe(true);
      expect(box('s-jest').checked).toBe(false);

      await click(box('s-jest'));
      await click(box('s-angular'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
        skillIds: ['s-ngrx', 's-jest'],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(job(1), '.stack').textContent).toMatch(/Tech stack:\s*NgRx, Jest/);
    });

    it('works the same for a project', async () => {
      await start();
      await click(tool(stackOf('Pierre O11y')));
      await click(box('s-ngrx'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.projects.update).toHaveBeenCalledWith('p-site', {
        skillIds: ['s-angular', 's-ngrx'],
      });
    });

    it('closes with Cancel without a request', async () => {
      await start();
      await click(tool(stackOf('KX')));
      await click(box('s-jest'));
      await click(buttonNamed(smallForm(), 'Cancel'));

      expect(el.querySelector('form.small-form')).toBeNull();
      expect(api.experiences.update).not.toHaveBeenCalled();
    });

    it('stays open with the API error when the stack is rejected', async () => {
      api.experiences.update.mockReturnValueOnce(badRequest('Unknown skill ids'));
      await start();
      await click(tool(stackOf('KX')));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['Unknown skill ids.']);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });
  });

  describe('the links form', () => {
    const openLinks = async () => click(tool('Edit links'));

    it('shows the current links and saves the profile with an added link and one removed', async () => {
      await start();
      await openLinks();
      expect(field(smallForm(), 'Link 1 label').value).toBe('LinkedIn');
      expect(field(smallForm(), 'Link 1 URL').value).toBe('https://www.linkedin.com/in/example');

      await click(buttonNamed(smallForm(), 'Add link'));
      type(field(smallForm(), 'Link 2 label'), 'GitHub');
      type(field(smallForm(), 'Link 2 URL'), 'https://github.com/example');
      await click($(smallForm(), 'button[aria-label="Remove link 1"]'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.saveProfile).toHaveBeenCalledTimes(1);
      expect(api.saveProfile).toHaveBeenCalledWith({
        ...adminProfile,
        links: [{ label: 'GitHub', url: 'https://github.com/example' }],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect($(header(), 'a[href="https://github.com/example"]').textContent).toContain('GitHub');
      expect(header().querySelector('a[href="https://www.linkedin.com/in/example"]')).toBeNull();
    });

    it.each([
      [
        'a URL that is not http(s)',
        'Link 1 URL',
        'javascript:alert(1)',
        'Enter a URL starting with http:// or https://',
      ],
      ['a link without a label', 'Link 1 label', '', 'Label is required'],
    ])('refuses %s without sending anything', async (_name, label, value, message) => {
      await start();
      await openLinks();
      type(field(smallForm(), label), value);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.saveProfile).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([message]);
    });

    it('stays open with the API error when the profile is rejected', async () => {
      api.saveProfile.mockReturnValueOnce(badRequest('links.0.url must be a URL address'));
      await start();
      await openLinks();
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['links.0.url must be a URL address.']);
      expect(el.querySelector('form.small-form')).not.toBeNull();
    });
  });

  describe('adding an item', () => {
    const addButton = (section: string, label: string) =>
      buttonNamed($(el, `section.${section}`), label);

    it('adds an experience at the end of the section, after the required fields are filled', async () => {
      await start();
      await click(addButton('experience', 'Add experience'));
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual([
        'Company is required',
        'Role is required',
        'Start date is required',
      ]);

      type(field(smallForm(), 'Company'), ' Acme ');
      type(field(smallForm(), 'Role'), 'Engineer');
      type(field(smallForm(), 'Start date'), '2027-01-01');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.experiences.create).toHaveBeenCalledTimes(1);
      expect(api.experiences.create).toHaveBeenCalledWith({
        company: 'Acme',
        role: 'Engineer',
        location: null,
        startDate: '2027-01-01',
        endDate: null,
        summary: null,
        skillIds: [],
        highlights: [],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(companies()).toEqual(['Whoz', 'KX', 'Acme']);
      expect(visible(inline(job(2), 'Role'))).toBe('Engineer');
    });

    it('adds a skill into its category group', async () => {
      await start();
      await click(addButton('skills', 'Add skill'));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.skills.create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual(['Name is required', 'Category is required']);

      type(field(smallForm(), 'Name'), 'Signals');
      type(field(smallForm(), 'Category'), 'State & Reactive');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api.skills.create).toHaveBeenCalledWith({
        name: 'Signals',
        category: 'State & Reactive',
        level: null,
      });
      const group = [...skillsSection().querySelectorAll('dd')][1];
      expect([...group.querySelectorAll('button.inline-text')].map((b) => visible(b))).toEqual([
        'NgRx',
        'Signals',
      ]);
    });

    it.each([
      {
        name: 'an education',
        section: 'education',
        button: 'Add education',
        required: ['School is required', 'Degree is required', 'Start date is required'],
        fill: { School: 'MIT', Degree: 'MSc', 'Start date': '2012-09-01' },
        resource: 'education' as const,
        body: {
          school: 'MIT',
          degree: 'MSc',
          field: null,
          location: null,
          startDate: '2012-09-01',
          endDate: null,
          description: null,
        },
        visibleAfter: () =>
          visible(inline($(el, 'section.education article:nth-of-type(2)'), 'School')),
        shown: 'MIT',
      },
      {
        name: 'a project',
        section: 'projects',
        button: 'Add project',
        required: ['Title is required', 'Description is required'],
        fill: { Title: 'Side project', Description: 'A small one.' },
        resource: 'projects' as const,
        body: {
          title: 'Side project',
          description: 'A small one.',
          url: null,
          repoUrl: null,
          imageUrl: null,
          startDate: null,
          endDate: null,
          skillIds: [],
          spans: [],
        },
        visibleAfter: () =>
          visible(inline($(el, 'section.projects article:nth-of-type(2)'), 'Title')),
        shown: 'Side project',
      },
    ])('adds $name at the end of its section', async (c) => {
      await start();
      await click(buttonNamed($(el, `section.${c.section}`), c.button));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api[c.resource].create).not.toHaveBeenCalled();
      expect(fieldErrors()).toEqual(c.required);

      for (const [label, value] of Object.entries(c.fill)) type(field(smallForm(), label), value);
      await click($(smallForm(), 'button[type="submit"]'));

      expect(api[c.resource].create).toHaveBeenCalledWith(c.body);
      expect(c.visibleAfter()).toBe(c.shown);
    });

    it('closes with Cancel without a request', async () => {
      await start();
      await click(addButton('experience', 'Add experience'));
      type(field(smallForm(), 'Company'), 'Acme');
      await click(buttonNamed(smallForm(), 'Cancel'));

      expect(el.querySelector('form.small-form')).toBeNull();
      expect(api.experiences.create).not.toHaveBeenCalled();
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('stays open with the API error when the item is rejected', async () => {
      api.skills.create.mockReturnValueOnce(badRequest('A skill with this slug already exists'));
      await start();
      await click(addButton('skills', 'Add skill'));
      type(field(smallForm(), 'Name'), 'Angular');
      type(field(smallForm(), 'Category'), 'Core Frameworks');
      await click($(smallForm(), 'button[type="submit"]'));

      expect(formAlerts()).toEqual(['A skill with this slug already exists.']);
      expect(field(smallForm(), 'Name').value).toBe('Angular');
    });
  });

  describe('deleting an item', () => {
    it.each([
      ['an experience', 'KX', 'experiences' as const, 'e-kx'],
      ['an education', 'ESIL', 'education' as const, 'ed-esil'],
      ['a project', 'Pierre O11y', 'projects' as const, 'p-site'],
      ['a skill', 'NgRx', 'skills' as const, 's-ngrx'],
    ])('deletes %s once the owner confirms', async (_name, title, resource, id) => {
      await start();
      await click(tool(`Delete "${title}"`));

      expect(window.confirm).toHaveBeenCalledWith(`Delete "${title}"?`);
      expect(api[resource].remove).toHaveBeenCalledTimes(1);
      expect(api[resource].remove).toHaveBeenCalledWith(id);
      expect(hasTool(`Delete "${title}"`)).toBe(false);
    });

    it('keeps the item, and sends nothing, when the owner cancels', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await start();
      await click(tool('Delete "KX"'));

      expect(api.experiences.remove).not.toHaveBeenCalled();
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('keeps the item and shows the API error when the deletion fails', async () => {
      api.experiences.remove.mockReturnValueOnce(badRequest('Cannot delete this experience'));
      await start();
      await click(tool('Delete "KX"'));

      expect(formAlerts()).toEqual(['Cannot delete this experience.']);
      expect(statuses()).toEqual(['Not saved']);
      expect(companies()).toEqual(['Whoz', 'KX']);
    });

    it('takes a deleted skill out of the tech stack shown and of the tech stack form', async () => {
      await start();
      await click(tool('Delete "NgRx"'));
      expect($(job(1), '.stack').textContent).toMatch(/Tech stack:\s*Angular\b/);
      expect($(job(1), '.stack').textContent).not.toContain('NgRx');

      await click(tool('Edit tech stack of "KX"'));
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { skillIds: ['s-angular'] });
    });

    it('takes a deleted skill out of the achievements, so the next achievement save no longer sends it', async () => {
      await start();
      await click(tool('Delete "NgRx"'));
      await write(await open(highlight(1, 1), 'Achievement'), 'Nx monorepo.', 'ctrl');

      const sent = api.experiences.update.mock.calls[0][1]['highlights'] as HighlightInput[];
      expect(sent.map((h) => h.skillIds)).toEqual([[], []]);
    });
  });

  describe('moving an item', () => {
    it('moves an item up with every id of the list, and applies it once the server answers', async () => {
      const reply = new Subject<unknown>();
      api.experiences.reorder.mockReturnValueOnce(reply);
      await start();
      await click(tool('Move "KX" up'));

      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz']);
      expect(companies()).toEqual(['Whoz', 'KX']);
      expect(statuses()).toEqual(['Saving…']);

      serverReorder('experiences', ['e-kx', 'e-whoz']);
      reply.next(undefined);
      reply.complete();
      await settle();
      expect(companies()).toEqual(['KX', 'Whoz']);
      expect(statuses()).toEqual(['Saved']);
    });

    it('moves an item down', async () => {
      await start();
      await click(tool('Move "Whoz" down'));

      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz']);
      expect(companies()).toEqual(['KX', 'Whoz']);
    });

    it.each([
      ['the first experience cannot go up', 'Move "Whoz" up'],
      ['the last experience cannot go down', 'Move "KX" down'],
      ['a single education cannot go up', 'Move "ESIL" up'],
      ['a single education cannot go down', 'Move "ESIL" down'],
      ['a single project cannot go up', 'Move "Pierre O11y" up'],
      ['a single project cannot go down', 'Move "Pierre O11y" down'],
    ])('%s', async (_name, label) => {
      await start();
      expect(tool(label).disabled).toBe(true);
    });

    it('can move the other experience in both directions', async () => {
      await start();
      expect(tool('Move "Whoz" down').disabled).toBe(false);
      expect(tool('Move "KX" up').disabled).toBe(false);
    });

    describe('skills', () => {
      // Core Frameworks: Angular, RxJS (with other categories between them in the list)
      beforeEach(() => server.lists.skills.push(structuredClone(rxjs) as unknown as Entity));

      it('moves a skill within its category, swapping with the nearest skill of that category', async () => {
        await start();
        await click(tool('Move "RxJS" up'));

        expect(api.skills.reorder).toHaveBeenCalledWith([
          's-rxjs',
          's-ngrx',
          's-jest',
          's-angular',
        ]);
        const core = [...skillsSection().querySelectorAll('dd')][0];
        expect([...core.querySelectorAll('button.inline-text')].map((b) => visible(b))).toEqual([
          'RxJS',
          'Angular',
        ]);
      });

      it.each([
        ['the first of its category cannot go up', 'Move "Angular" up', true],
        ['the last of its category cannot go down', 'Move "RxJS" down', true],
        ['the first of its category can go down', 'Move "Angular" down', false],
        ['the last of its category can go up', 'Move "RxJS" up', false],
        ['a skill alone in its category cannot go up', 'Move "NgRx" up', true],
        ['a skill alone in its category cannot go down', 'Move "NgRx" down', true],
      ])('%s', async (_name, label, disabled) => {
        await start();
        expect(tool(label).disabled).toBe(disabled);
      });
    });
  });

  describe('overlapping saves', () => {
    /** Starts the next profile PUT as a pending request the test answers itself. */
    const holdProfileSave = () => {
      const pending = new Subject<unknown>();
      api.saveProfile.mockReturnValueOnce(pending);
      return pending;
    };
    /** The server accepts the PUT the page sent and answers it. */
    const answerProfileSave = (pending: Subject<unknown>, call: number) => {
      const sent = api.saveProfile.mock.calls[call][0];
      server.profile = structuredClone(sent);
      pending.next(structuredClone(sent));
      pending.complete();
    };
    const statusOf = (node: Element) =>
      node.closest('app-inline-text')?.querySelector('span.save-status')?.textContent?.trim();

    it('sends a second profile text only after the first answer, with both changes', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');
      await write(await open(header(), 'Location'), 'Paris, France', 'enter');

      expect(api.saveProfile).toHaveBeenCalledTimes(1);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      answerProfileSave(first, 0);
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        headline: 'New headline',
        location: 'Paris, France',
      });
      expect(visible(inline(header(), 'Headline'))).toBe('New headline');
      expect(visible(inline(header(), 'Location'))).toBe('Paris, France');
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('sends the second achievement of an experience with the first one already in', async () => {
      const first = new Subject<unknown>();
      api.experiences.update.mockReturnValueOnce(first);
      await start();
      await write(await open(highlight(1, 0), 'Achievement'), 'First, edited', 'ctrl');
      await write(await open(highlight(1, 1), 'Achievement'), 'Second, edited', 'ctrl');

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      first.next(serverUpdate('experiences', 'e-kx', api.experiences.update.mock.calls[0][1]));
      first.complete();
      await settle();

      expect(api.experiences.update).toHaveBeenCalledTimes(2);
      const sent = api.experiences.update.mock.calls[1][1]['highlights'] as HighlightInput[];
      expect(sent.map((h) => h.message)).toEqual(['First, edited', 'Second, edited']);
      expect(sent.map((h) => h.id)).toEqual(['h-1', 'h-2']);
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('sends the links with a profile text saved just before', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');

      await click(tool('Edit links'));
      await click(buttonNamed(smallForm(), 'Add link'));
      type(field(smallForm(), 'Link 2 label'), 'GitHub');
      type(field(smallForm(), 'Link 2 URL'), 'https://github.com/example');
      await click($(smallForm(), 'button[type="submit"]'));
      expect(api.saveProfile).toHaveBeenCalledTimes(1);

      answerProfileSave(first, 0);
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        headline: 'New headline',
        links: [...adminProfile.links, { label: 'GitHub', url: 'https://github.com/example' }],
      });
      expect(el.querySelector('form.small-form')).toBeNull();
      expect(visible(inline(header(), 'Headline'))).toBe('New headline');
    });

    it('runs a write of another kind of item after the pending write too', async () => {
      const first = holdProfileSave();
      await start();
      await write(await open(header(), 'Headline'), 'New headline', 'enter');
      await write(await open(job(1), 'Role'), 'Lead Engineer', 'enter');

      expect(api.experiences.update).not.toHaveBeenCalled();
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      answerProfileSave(first, 0);
      await settle();

      expect(api.experiences.update).toHaveBeenCalledTimes(1);
      expect(api.experiences.update).toHaveBeenCalledWith('e-kx', { role: 'Lead Engineer' });
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('moves two items of one list one after the other, the second from the new order', async () => {
      server.lists.experiences.push({
        ...structuredClone(kx),
        id: 'e-third',
        company: 'Third',
        sortOrder: 2,
        highlights: [],
      } as unknown as Entity);
      const first = new Subject<unknown>();
      api.experiences.reorder.mockReturnValueOnce(first);
      await start();
      expect(companies()).toEqual(['Whoz', 'KX', 'Third']);

      await click(tool('Move "Whoz" down'));
      await click(tool('Move "Third" up'));
      expect(api.experiences.reorder).toHaveBeenCalledTimes(1);
      expect(api.experiences.reorder).toHaveBeenCalledWith(['e-kx', 'e-whoz', 'e-third']);
      expect(companies()).toEqual(['Whoz', 'KX', 'Third']);
      expect(statuses()).toEqual(['Saving…', 'Saving…']);

      serverReorder('experiences', ['e-kx', 'e-whoz', 'e-third']);
      first.next(undefined);
      first.complete();
      await settle();

      expect(api.experiences.reorder).toHaveBeenCalledTimes(2);
      expect(api.experiences.reorder).toHaveBeenLastCalledWith(['e-kx', 'e-third', 'e-whoz']);
      expect(companies()).toEqual(['KX', 'Third', 'Whoz']);
      expect(statuses()).toEqual(['Saved', 'Saved']);
    });

    it('still sends a queued write when the one before it fails, from the unchanged state', async () => {
      const first = holdProfileSave();
      await start();
      const headline = await open(header(), 'Headline');
      await write(headline, 'Too much', 'enter');
      await write(await open(header(), 'Location'), 'Paris, France', 'enter');
      expect(api.saveProfile).toHaveBeenCalledTimes(1);

      first.error(
        new HttpErrorResponse({
          status: 400,
          error: { message: ['headline must be shorter than or equal to 160 characters'] },
        }),
      );
      await settle();

      expect(api.saveProfile).toHaveBeenCalledTimes(2);
      expect(api.saveProfile).toHaveBeenLastCalledWith({
        ...adminProfile,
        location: 'Paris, France',
      });
      expect(statusOf(fieldIn(header(), 'Headline'))).toBe('Not saved');
      expect(fieldIn(header(), 'Headline').value).toBe('Too much');
      expect(fieldErrors()).toEqual(['headline must be shorter than or equal to 160 characters.']);
      expect(statusOf(inline(header(), 'Location'))).toBe('Saved');
      expect(visible(inline(header(), 'Location'))).toBe('Paris, France');
      press(fieldIn(header(), 'Headline'), 'Escape');
      await settle();
      expect(visible(inline(header(), 'Headline'))).toBe(
        'Senior Front-End Engineer | Angular Specialist',
      );
    });

    describe('text typed while its save is pending', () => {
      it('saves the newer text of a profile field once the pending saves are in', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        const location = await open(header(), 'Location');
        await write(location, 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(statuses()).toEqual(['Saving…', 'Saving…']);

        await write(location, 'Paris, France (remote)', 'blur');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(3);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          location: 'Paris, France (remote)',
        });
        expect(el.querySelector('input, textarea')).toBeNull();
        expect(visible(inline(header(), 'Headline'))).toBe('New headline');
        expect(visible(inline(header(), 'Location'))).toBe('Paris, France (remote)');
        expect(statuses()).toEqual(['Saved', 'Saved']);
      });

      it('saves the newer text of an item field with a second PATCH of that key only', async () => {
        const pending = new Subject<unknown>();
        api.experiences.update.mockReturnValueOnce(pending);
        await start();
        const role = await open(job(1), 'Role');
        await write(role, 'Lead', 'enter');
        expect(statuses()).toEqual(['Saving…']);

        type(role, 'Lead Engineer');
        await settle();
        pending.next(serverUpdate('experiences', 'e-kx', { role: 'Lead' }));
        pending.complete();
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(2);
        expect(api.experiences.update).toHaveBeenLastCalledWith('e-kx', { role: 'Lead Engineer' });
        expect(job(1).querySelector('input, textarea')).toBeNull();
        expect(visible(inline(job(1), 'Role'))).toBe('Lead Engineer');
        expect(statuses()).toEqual(['Saved']);
      });
    });

    describe('small forms while their write is pending', () => {
      const disabledControls = (selector: string) =>
        [...smallForm().querySelectorAll<HTMLElement>(selector)].map((c) => c.matches(':disabled'));

      it('makes the dates form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit dates of "KX"'));
        type(field(smallForm(), 'End date'), '2024-01-01');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        expect(disabledControls('input')).toEqual([true, true]);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          startDate: '2022-09-01',
          endDate: '2024-01-01',
        });
        expect(el.querySelector('form.small-form')).toBeNull();
      });

      it('makes the links form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit links'));
        type(field(smallForm(), 'Link 1 label'), 'LinkedIn profile');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        expect(disabledControls('input')).toEqual([true, true]);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(el.querySelector('form.small-form')).toBeNull();
      });

      it('makes the tech stack form read-only until its write is done, then closes it', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await click(tool('Edit tech stack of "KX"'));
        await click($(smallForm(), 'input[type="checkbox"][value="s-jest"]'));
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        const boxes = disabledControls('input[type="checkbox"]');
        expect(boxes.length).toBeGreaterThan(0);
        expect(boxes.every(Boolean)).toBe(true);
        expect($(smallForm(), 'button[type="submit"]').matches(':disabled')).toBe(true);

        answerProfileSave(first, 0);
        await settle();
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          skillIds: ['s-angular', 's-ngrx', 's-jest'],
        });
        expect(el.querySelector('form.small-form')).toBeNull();
      });
    });

    describe('when the control that started a write is gone', () => {
      it('still sends the queued writes, in order and with both changes, after leaving the page', async () => {
        const first = holdProfileSave();
        const { router } = await startWithAdminRoute();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await write(await open(header(), 'Location'), 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        await router.navigateByUrl('/admin');
        await settle();
        expect(el.textContent).toContain('admin home');
        expect(el.querySelector('header.resume-header')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(2);
        expect(api.saveProfile).toHaveBeenLastCalledWith({
          ...adminProfile,
          headline: 'New headline',
          location: 'Paris, France',
        });
        expect(server.profile).toMatchObject({
          headline: 'New headline',
          location: 'Paris, France',
        });
      });

      // The "Dates" button closes the form while its write waits: that destroys the DatesForm
      // that holds the pending write (Cancel does the same).
      it('still sends the dates of a form closed while its write is queued, with no error', async () => {
        const first = holdProfileSave();
        await start();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        const toggle = tool('Edit dates of "KX"');
        await click(toggle);
        type(field(smallForm(), 'End date'), '2024-01-01');
        await click($(smallForm(), 'button[type="submit"]'));
        expect(api.experiences.update).not.toHaveBeenCalled();

        await click(toggle);
        expect(el.querySelector('form.small-form')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.experiences.update).toHaveBeenCalledTimes(1);
        expect(api.experiences.update).toHaveBeenCalledWith('e-kx', {
          startDate: '2022-09-01',
          endDate: '2024-01-01',
        });
        expect($(job(1), '.meta').textContent).toContain('Sep 2022 – Jan 2024');
        expect(formAlerts()).toEqual([]);
        expect(el.querySelector('.form-error')).toBeNull();
      });
    });

    // The converse (the queued write IS sent while the session lasts) is the test above,
    // "still sends the queued writes ... after leaving the page".
    describe('when the owner signs out while a write is queued', () => {
      it('does not send the queued write once the session has ended, even after leaving the page', async () => {
        const first = holdProfileSave();
        const { router } = await startWithAdminRoute();
        await write(await open(header(), 'Headline'), 'New headline', 'enter');
        await write(await open(header(), 'Location'), 'Paris, France', 'enter');
        expect(api.saveProfile).toHaveBeenCalledTimes(1);

        isAuthenticated.set(false);
        await router.navigateByUrl('/admin');
        await settle();
        expect(el.querySelector('header.resume-header')).toBeNull();

        answerProfileSave(first, 0);
        await settle();

        expect(api.saveProfile).toHaveBeenCalledTimes(1);
        expect(server.profile).toMatchObject({ headline: 'New headline' });
        expect(server.profile).not.toMatchObject({ location: 'Paris, France' });
      });
    });
  });

  describe('links to the full forms', () => {
    it.each([
      ['an experience', 'KX', '/admin/experiences/e-kx'],
      ['an education', 'ESIL', '/admin/education/ed-esil'],
      ['a project', 'Pierre O11y', '/admin/projects/p-site'],
      ['a skill', 'NgRx', '/admin/skills/s-ngrx'],
      ['the profile', 'Profile', '/admin/profile'],
    ])('opens the full form of %s', async (_name, title, href) => {
      await start();
      const link = $<HTMLAnchorElement>(el, `a[aria-label='Full form for "${title}"']`);
      expect(link.textContent?.trim()).toBe('Full form');
      expect(link.getAttribute('href')).toBe(href);
    });

    it('gives the profile no move or delete buttons, only its links form and full form', async () => {
      await start();
      expect(hasTool('Move "Profile" up')).toBe(false);
      expect(hasTool('Move "Profile" down')).toBe(false);
      expect(hasTool('Delete "Profile"')).toBe(false);
      expect(hasTool('Edit links')).toBe(true);
    });

    it('offers only the small forms that fit each item', async () => {
      await start();
      expect(hasTool('Edit dates of "KX"')).toBe(true);
      expect(hasTool('Edit tech stack of "KX"')).toBe(true);
      expect(hasTool('Edit dates of "ESIL"')).toBe(true);
      expect(hasTool('Edit tech stack of "ESIL"')).toBe(false);
      expect(hasTool('Edit dates of "Angular"')).toBe(false);
      expect(hasTool('Edit tech stack of "Angular"')).toBe(false);
    });

    it('still leads to the profile form when there is no profile yet', async () => {
      server.profile = null;
      await start();
      expect(el.querySelector('header.resume-header')).toBeNull();
      expect($(el, `a[aria-label='Full form for "Profile"']`).getAttribute('href')).toBe(
        '/admin/profile',
      );
      expect(hasTool('Edit links')).toBe(false);
      expect(companies()).toEqual(['Whoz', 'KX']);
    });
  });
});
