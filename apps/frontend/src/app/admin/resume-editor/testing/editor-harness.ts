import { afterEach, beforeEach, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import type { HighlightInput, Profile, Skill } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ContentApi } from '../../../core/content/content-api.service';
import { $ } from '../../../testing';
import { esil, kx, profile, site, skills, whoz } from '../../testing/fixtures';
import { renderRoute, type } from '../../testing/render';
import { ResumeEditorPage } from '../resume-editor-page';

// The page under test, its in-memory API and the DOM helpers shared by the resume-editor-page specs.

@Component({ template: 'public resume' })
export class PublicResume {}

@Component({ selector: 'app-test-admin-home', template: 'admin home' })
export class AdminHome {}

// ---------------------------------------------------------------------------------------------
// A tiny in-memory API, so the page sees what a real server would answer.
// ---------------------------------------------------------------------------------------------

export type Resource = 'skills' | 'experiences' | 'education' | 'projects';
export type Entity = { id: string; sortOrder: number } & Record<string, unknown>;
export type Body = Record<string, unknown>;
export type Reply = Observable<unknown>;

/** The admin's profile: the phone is set but hidden (`showPhone: false`). */
export const adminProfile: Profile = { ...profile, phone: '+33 6 00 00 00 00', showPhone: false };
export const rxjs: Skill = {
  id: 's-rxjs',
  name: 'RxJS',
  slug: 'rxjs',
  category: 'Core Frameworks',
  level: null,
  sortOrder: 3,
};

export let server: { profile: Profile | null; lists: Record<Resource, Entity[]> };
export let nextId: number;

export const seed = () => {
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

export const CREATE_DEFAULTS: Record<Resource, Body> = {
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
export function toHighlights(inputs: HighlightInput[]) {
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

export function withHighlights(body: Body): Body {
  return body['highlights']
    ? { ...body, highlights: toHighlights(body['highlights'] as HighlightInput[]) }
    : body;
}

export function serverCreate(key: Resource, body: Body): Entity {
  const entity = {
    ...CREATE_DEFAULTS[key],
    ...withHighlights(body),
    id: `new-${nextId++}`,
    sortOrder: server.lists[key].length,
  };
  server.lists[key].push(entity);
  return structuredClone(entity);
}

export function serverUpdate(key: Resource, id: string, body: Body): Entity {
  const list = server.lists[key];
  const index = list.findIndex((e) => e.id === id);
  list[index] = { ...list[index], ...withHighlights(body) };
  return structuredClone(list[index]);
}

export function serverRemove(key: Resource, id: string): void {
  server.lists[key] = server.lists[key].filter((e) => e.id !== id);
}

export function serverReorder(key: Resource, ids: string[]): void {
  const byId = new Map(server.lists[key].map((e) => [e.id, e]));
  server.lists[key] = ids.map((id, i) => ({ ...(byId.get(id) as Entity), sortOrder: i }));
}

export function crud(key: Resource) {
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

export let api: ReturnType<typeof buildApi>;
export function buildApi() {
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

export const badRequest = (...messages: string[]) =>
  throwError(() => new HttpErrorResponse({ status: 400, error: { message: messages } }));

// ---------------------------------------------------------------------------------------------
// Helpers to drive the page like a user
// ---------------------------------------------------------------------------------------------

export let el: HTMLElement;
export let settle: () => Promise<void>;
/** The owner's session: the editor is an admin page, always reached signed in. */
export let isAuthenticated: WritableSignal<boolean>;

export async function start() {
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
export function visible(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll('.sr-only').forEach((n) => n.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The button of an editable text: its accessible name starts with "Edit <label>: ". */
export function inline(scope: ParentNode, label: string, value?: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button.inline-text')].find(
    (b) =>
      (b.textContent ?? '').trim().startsWith(`Edit ${label}:`) &&
      (value === undefined || visible(b) === value),
  );
  if (!found) throw new Error(`No editable "${label}"${value === undefined ? '' : ` "${value}"`}`);
  return found;
}

export const fieldIn = (scope: ParentNode, label: string) =>
  $<HTMLInputElement | HTMLTextAreaElement>(
    scope,
    `input[aria-label="${label}"], textarea[aria-label="${label}"]`,
  );

/** Clicks an editable text and returns the field that opens. */
export async function open(scope: ParentNode, label: string, value?: string) {
  inline(scope, label, value).click();
  await settle();
  return fieldIn(scope, label);
}

export function press(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

export type SaveWith = 'enter' | 'ctrl' | 'meta' | 'blur';

/** Types a value and saves it the way the user chose. */
export async function write(
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  how: SaveWith,
) {
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
export async function startWithAdminRoute() {
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

export const texts = (selector: string) =>
  [...el.querySelectorAll(selector)].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
export const statuses = () => texts('span.save-status[role="status"]').filter(Boolean);
export const fieldErrors = () => texts('.field-error').filter(Boolean);
export const formAlerts = () => texts('p.form-error[role="alert"]').filter(Boolean);

export const header = () => $(el, 'header.resume-header');
export const jobs = () => [...el.querySelectorAll<HTMLElement>('section.experience article')];
export function job(n: number): HTMLElement {
  const found = jobs()[n];
  if (!found) throw new Error(`No experience #${n + 1} (found ${jobs().length})`);
  return found;
}
export const companies = () => jobs().map((j) => visible(inline(j, 'Company')));
export const projectArticle = () => $(el, 'section.projects article');
export const educationArticle = () => $(el, 'section.education article');
export const skillsSection = () => $(el, 'section.skills');
export function highlight(jobN: number, n: number): HTMLElement {
  const found = job(jobN).querySelectorAll<HTMLElement>('li.highlight')[n];
  if (!found) throw new Error(`No achievement #${n + 1} in experience #${jobN + 1}`);
  return found;
}

export const tool = (label: string) => $<HTMLButtonElement>(el, `[aria-label='${label}']`);
export const hasTool = (label: string) => el.querySelector(`[aria-label='${label}']`) !== null;
export const smallForm = () => $(el, 'form.small-form');

export function buttonNamed(scope: ParentNode, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`No button "${text}"`);
  return found;
}

export async function click(button: HTMLElement) {
  button.click();
  await settle();
}

/** The shared setup of every resume editor spec: a fresh in-memory server, API and session. */
export function setUpEditorTests(): void {
  beforeEach(() => {
    seed();
    api = buildApi();
    isAuthenticated = signal(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
}
