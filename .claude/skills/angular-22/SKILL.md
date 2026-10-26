---
name: angular-22
description: Angular 22 conventions for this project (myResume). Use whenever writing, generating, reviewing or refactoring Angular code in apps/frontend or libs/frontend — components, services, routes, tests. Covers @Service instead of @Injectable, default OnPush change detection, zoneless signals-based code, signal forms (the default for forms) and zoneless testing patterns.
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
- Prefix `app-` for selectors (lint enforced). Pages are lazy-loaded with `loadComponent`, and their `title` comes from the route (see `.claude/rules/frontend.md`).

## 3. Zoneless: state lives in signals

- There is no zone.js. The UI updates when a **signal read by the template** changes, or when an event or input fires.
- So: keep view state in signals. In a service, expose `readonly x = this.state.asReadonly()`.
- RxJS is fine for streams (HTTP, WebSockets, polling), but end in a signal: `.subscribe(v => this.state.set(v))` or `toSignal(...)`. Clean up with `takeUntilDestroyed()` or `DestroyRef`.
- For async data, consider `resource()` / `httpResource()` instead of hand-written loading/error flags.
- Don't use `ChangeDetectorRef.detectChanges()` or `markForCheck()` to "fix" a view that doesn't update; the state should be a signal.
- `effect()` is for syncing with things outside Angular (DOM APIs, storage, charts). Don't use it to copy one signal into another; use `computed`/`linkedSignal`.

## 4. Forms: signal forms by default

Signal forms (`@angular/forms/signals`) are stable in Angular 22. Use them for **every new form**. Don't use reactive forms (`FormBuilder`, `FormGroup`, `FormControl`, `Validators`, `ReactiveFormsModule`) or template-driven forms (`ngModel`) unless one of the exceptions below applies.

The model is a plain `signal()`, and it is the source of truth. `form()` builds a `FieldTree` around it, and the schema function declares the rules. No `getRawValue()`, `patchValue()` or `FormArray`: read and write `this.model` directly.

```ts
import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  applyEach,
  email,
  form,
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

interface LinkModel {
  label: string;
  url: string;
}
interface ProfileModel {
  fullName: string;
  email: string;
  startDate: string;
  endDate: string;
  yearsInIt: number | null; // <input type="number"> writes null when empty
  links: LinkModel[];
}

@Component({
  selector: 'app-profile-page',
  imports: [FormField, FormRoot],
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly api = inject(ContentApi);
  protected readonly error = signal<string | null>(null);
  protected readonly model = signal<ProfileModel>({
    fullName: '',
    email: '',
    startDate: '',
    endDate: '',
    yearsInIt: null,
    links: [],
  });

  protected readonly form = form(
    this.model,
    (p) => {
      required(p.fullName, { message: 'Full name is required' });
      maxLength(p.fullName, 120);
      required(p.email, { message: 'Email is required' });
      email(p.email, { message: 'Enter a valid email address' });
      min(p.yearsInIt, 0);
      max(p.yearsInIt, 80);
      // Cross-field rule: the error lands on the field it is about.
      validate(p.endDate, ({ value, valueOf }) =>
        value() && value() < valueOf(p.startDate)
          ? { kind: 'endBeforeStart', message: 'End date must be on or after the start date' }
          : undefined,
      );
      applyEach(p.links, (link) => {
        required(link.label, { message: 'Label is required' });
        maxLength(link.label, 40);
      });
    },
    {
      // <form [formRoot]> calls this on submit, after marking every field touched,
      // and only when the form is valid. form().submitting() is true meanwhile.
      submission: {
        action: async () => {
          this.error.set(null);
          try {
            await firstValueFrom(this.api.saveProfile(toProfile(this.model())));
          } catch (e) {
            this.error.set(apiErrorMessage(e));
          }
        },
      },
    },
  );

  protected addLink(): void {
    this.model.update((m) => ({ ...m, links: [...m.links, { label: '', url: '' }] }));
  }

  protected removeLink(index: number): void {
    this.model.update((m) => ({ ...m, links: m.links.filter((_, i) => i !== index) }));
  }
}
```

```html
<form [formRoot]="form" novalidate>
  <label for="pf-email">Email</label>
  <input
    id="pf-email"
    type="email"
    [formField]="form.email"
    [attr.aria-invalid]="(form.email().touched() && form.email().invalid()) || null"
  />
  @if (form.email().touched()) { @for (e of form.email().errors(); track e.kind) {
  <p class="field-error">{{ e.message }}</p>
  } } @for (link of form.links; track $index; let i = $index) {
  <input [formField]="link.label" />
  <button type="button" (click)="removeLink(i)">Remove</button>
  }

  <button class="button primary" type="submit" [disabled]="form().submitting()">Save</button>
</form>
```

Rules:

- Field state is read by **calling** the field: `form.email().value()`, `.valid()`, `.invalid()`, `.touched()`, `.dirty()`, `.errors()`, `.pending()`, `form().submitting()`. They are all signals, so the view stays in sync without zone.js.
- Bind inputs with `[formField]="form.x"` (import `FormField`). Don't add `[value]`, `(input)`, `formControlName` or `ngModel` on the same element.
- Put the message on the rule (`{ message: '...' }`) and render `errors()` in the template. Don't build a `hasError('x') ? ... : ...` chain.
- Show a field's errors once it is `touched()`. Submitting through `[formRoot]` (or `submit(form, action)`) marks every field touched, so no separate `submitted` flag is needed.
- Use `<form [formRoot]="form">` with `submission` in the `form()` options. Use `(submit)` plus `submit(this.form, action)` only when one form needs more than one submit action.
- Loading existing data: `this.model.set(toModel(entity))`. Converting back to the API type (trimming, `''` → `null`) happens in one pure `toX(model)` function, which is easy to unit test.
- Reusable rules are plain functions that take a `SchemaPath` and call `validate()`. The admin ones live in `admin/shared/form-utils.ts` (`httpUrl`, `endOnOrAfterStart`, `showError`); reuse them. Group rules into a `schema<T>(...)` and reuse them with `apply()` / `applyEach()`.
- Conditional rules: `required(p.metric, { when: ({ valueOf }) => valueOf(p.hasImpact) })`, or `applyWhen(...)` for a group of rules. `hidden()`, `disabled()` and `readonly()` are also schema rules, so don't toggle them by hand.
- Lists are arrays in the model. Add, remove and reorder by updating `this.model`. Iterate with `@for (item of form.items; track $index)`.
- A custom input component implements `FormValueControl<T>` (a `value = model<T>()`) and is then bound with `[formField]` like a native input. Don't write a `ControlValueAccessor` for new components.

When reactive forms are still acceptable (say why in a comment):

- a third-party component or library that only works with `FormControl`/`FormGroup` or a `ControlValueAccessor` and that the `@angular/forms/signals/compat` interop can't cover
- an existing reactive form in code you only touch lightly (there are none left in `apps/frontend` today). When you rework one, migrate it to signal forms (tests first).

Never mix both APIs inside one form.

Testing: set values the way a user does (`input.value = 'x'; input.dispatchEvent(new Event('input'))`, or the `type()` helper in `admin/testing/render.ts`), then `await fixture.whenStable()`. Submit by clicking the submit button, and assert on the rendered errors and the API calls. Don't assert on the model or `FieldTree` internals.

## 5. Tests (Vitest, zoneless): test first, as `CLAUDE.md` requires

- **No `fakeAsync`/`tick`/`waitForAsync`**: they need zone.js. Use `await fixture.whenStable()` and Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTime()`), and restore them in `afterEach`.
- HTTP: `providers: [provideHttpClient(), provideHttpClientTesting()]`, then `HttpTestingController` with `expectOne`, `flush(body, { status, statusText })`, `error(new ProgressEvent('error'))`, and `verify()` in `afterEach`.
- Routing: `provideRouter(routes)` and `RouterTestingHarness.create()`, then `navigateByUrl()` and `harness.detectChanges()`.
- Components: `TestBed.createComponent()`, set signal inputs with `fixture.componentRef.setInput('value', 42)`, then `await fixture.whenStable()`.
- Fake a service with signals: `{ provide: X, useValue: { status: signal('up').asReadonly(), startPolling: vi.fn() } }`.
- Query the DOM the way a user perceives it: roles, labels, text, `aria-*`. Avoid testing private fields.
- Run one file: `npx nx test frontend --include=src/app/<path>.spec.ts`.

## 6. Generating code

- Component: `npx nx g @nx/angular:component apps/frontend/src/app/<area>/<name>/<name>`. The last segment is the file name; repeat the name to get its own folder. It creates `<name>.ts/.html/.scss/.spec.ts`, with SCSS as the default in `nx.json`.
- Service: `npx nx g @schematics/angular:service --project=frontend --name=<name> --path=apps/frontend/src/app/core/<area>`. It already generates `@Service()`.
- Check generated code against this skill anyway, and replace the generated "should be created" spec with real behavior tests (test first).

## 7. Before saying done

`npx nx run-many -t lint test build typecheck -p frontend`. Lint must be clean: the no-`changeDetection` and `@Service` rules are part of it.
