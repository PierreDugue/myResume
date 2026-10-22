---
name: angular-22
description: Angular 22 conventions for this project (myResume). Use whenever writing, generating, reviewing or refactoring Angular code in apps/frontend or libs/frontend — components, services, routes, tests. Covers @Service instead of @Injectable, default OnPush change detection, zoneless signals-based code and zoneless testing patterns.
---

# Angular 22 in myResume

The project runs **Angular 22.1, zoneless**. Many older habits are now wrong or redundant. Follow this skill rather than older Angular knowledge. ESLint enforces the first two rules (`eslint.angular.mjs`), so `npx nx lint frontend` fails if they're broken.

## 1. Services: `@Service()`, not `@Injectable({ providedIn: 'root' })`

```ts
import { Service, inject, signal } from '@angular/core';

@Service() // provided in root automatically (autoProvided defaults to true)
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>('dark');
  readonly theme = this.current.asReadonly();
}
```

- For a service that should **not** be provided automatically (component-level or opt-in providers), use `@Service({ autoProvided: false })` and provide it where needed.
- `@Service({ factory: () => ... })` creates the value with a factory.
- Use `inject()` for dependencies, not constructor parameters.
- Tests can still replace a service: `{ provide: ApiStatusService, useValue: fake }`.
- If a class must also serve as a router strategy or another token, register it with `useExisting` so there is only **one** instance (see `providePageTitleStrategy()` in `core/title/page-title.strategy.ts`).
- Use `@Injectable` only if `@Service` can't express what you need, and explain why in a comment.

## 2. Components: don't set `changeDetection`

OnPush is the default since Angular 22. `ChangeDetectionStrategy.Eager` is the opt-out, and it isn't allowed here.

```ts
@Component({
  selector: 'app-stat-panel',
  imports: [RouterLink],
  templateUrl: './stat-panel.html',
  styleUrl: './stat-panel.scss',
})
export class StatPanel {
  readonly value = input.required<number>();
  readonly unit = input<string>('');
  readonly selected = output<number>();
  protected readonly label = computed(() => `${this.value()} ${this.unit()}`);
}
```

- Standalone only (no NgModules). Don't write `standalone: true`; it's the default.
- Signal APIs: `input()`, `input.required()`, `output()`, `model()`, `computed()`, `linkedSignal()`, `viewChild()`, `contentChildren()`, and so on. No `@Input`/`@Output`/`@ViewChild` decorators.
- Templates use `@if`, `@for (x of xs; track x.id)`, `@switch`, `@defer`, `@let`. No `*ngIf`/`*ngFor`/`ngClass`/`ngStyle`; use `[class.x]` and `[style.x]`.
- Protected members for template-only state; `readonly` for signals and injected things.
- Prefix `app-` for selectors (lint enforced). Pages are lazy-loaded with `loadComponent`, and their `title` comes from the route (see the `CLAUDE.md` frontend conventions).

## 3. Zoneless: state lives in signals

- There is no zone.js. The UI updates when a **signal read by the template** changes, or when an event or input fires.
- So: keep view state in signals. In a service, expose `readonly x = this.state.asReadonly()`.
- RxJS is fine for streams (HTTP, WebSockets, polling), but end in a signal: `.subscribe(v => this.state.set(v))` or `toSignal(...)`. Clean up with `takeUntilDestroyed()` or `DestroyRef`.
- For async data, consider `resource()` / `httpResource()` instead of hand-written loading/error flags.
- Don't use `ChangeDetectorRef.detectChanges()` or `markForCheck()` to "fix" a view that doesn't update; the state should be a signal.
- `effect()` is for syncing with things outside Angular (DOM APIs, storage, charts). Don't use it to copy one signal into another; use `computed`/`linkedSignal`.

## 4. Tests (Vitest, zoneless): test first, as `CLAUDE.md` requires

- **No `fakeAsync`/`tick`/`waitForAsync`**: they need zone.js. Use `await fixture.whenStable()` and Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTime()`), and restore them in `afterEach`.
- HTTP: `providers: [provideHttpClient(), provideHttpClientTesting()]`, then `HttpTestingController` with `expectOne`, `flush(body, { status, statusText })`, `error(new ProgressEvent('error'))`, and `verify()` in `afterEach`.
- Routing: `provideRouter(routes)` and `RouterTestingHarness.create()`, then `navigateByUrl()` and `harness.detectChanges()`.
- Components: `TestBed.createComponent()`, set signal inputs with `fixture.componentRef.setInput('value', 42)`, then `await fixture.whenStable()`.
- Fake a service with signals: `{ provide: X, useValue: { status: signal('up').asReadonly(), startPolling: vi.fn() } }`.
- Query the DOM the way a user perceives it: roles, labels, text, `aria-*`. Avoid testing private fields.
- Run one file: `npx nx test frontend --include=src/app/<path>.spec.ts`.

## 5. Generating code

- Component: `npx nx g @nx/angular:component apps/frontend/src/app/<area>/<name>/<name>`. The last segment is the file name; repeat the name to get its own folder. It creates `<name>.ts/.html/.scss/.spec.ts`, with SCSS as the default in `nx.json`.
- Service: `npx nx g @schematics/angular:service --project=frontend --name=<name> --path=apps/frontend/src/app/core/<area>`. It already generates `@Service()`.
- Check generated code against this skill anyway, and replace the generated "should be created" spec with real behavior tests (test first).

## 6. Before saying done

`npx nx run-many -t lint test build typecheck -p frontend`. Lint must be clean: the no-`changeDetection` and `@Service` rules are part of it.
