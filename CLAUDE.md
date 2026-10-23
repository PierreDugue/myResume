# myResume

Personal resume site presented as an observability platform (inspired by Grafana). Anyone can view the public pages; a single admin (the owner) logs in to edit the content.
The product spec is in [docs/spec.md](docs/spec.md) and the API contract in [docs/api-contract.md](docs/api-contract.md). Read both before starting a feature.

## Stack

**Nx 23.3 monorepo** (integrated): one root `package.json` and one `node_modules`. TypeScript is `strict` everywhere.

| Project        | Tech                                                      | Path                      |
| -------------- | --------------------------------------------------------- | ------------------------- |
| `frontend`     | Angular 22 (standalone, zoneless, signals), SCSS, esbuild | `apps/frontend`           |
| `frontend-e2e` | Cypress end-to-end tests                                  | `apps/frontend-e2e`       |
| `backend`      | NestJS 11, TypeORM, webpack build                         | `apps/backend`            |
| `api-models`   | Shared API types (`@my-resume/api-models`)                | `libs/shared/api-models`  |
| Database       | PostgreSQL 16                                             | Docker service `postgres` |

**Unit tests use Vitest in every project**:

- the frontend runs it through `@angular/build:unit-test`
- the backend and the libraries run it through `@nx/vitest`

Put code used by more than one app in `libs/`. Create libraries with Nx generators, never by hand:

- `npx nx g @nx/js:library libs/shared/<name> --importPath=@my-resume/<name> --bundler=none --unitTestRunner=vitest`
- `npx nx g @nx/angular:library libs/frontend/<name> --unitTestRunner=vitest-angular` for Angular UI libraries

Libraries:

- `libs/shared/api-models` (`@my-resume/api-models`): API types
- `libs/shared/resume-metrics` (`@my-resume/resume-metrics`): pure calculations behind the dashboards (`buildDashboard`, month arithmetic). The backend calls it and the frontend reuses its helpers (e.g. `monthIndex`). Unit-test every rule here, with hand-checkable fixtures (`src/lib/fixtures.ts`).
- `libs/shared/query-parser` (`@my-resume/query-parser`): the LogQL-style query language of Explore: `parseQuery` (with column-precise `QueryParseError`s), `compileQuery` (matching; regexes run with `re2js`, in linear time, because visitors' queries run on the server: never use `RegExp` on query input), `suggest`/`applySuggestion` (autocomplete) and `withLabelMatcher`. The backend filters with it and the frontend checks queries and suggests labels with it. Unit-test every rule here.
- Angular UI stays in the app (`apps/frontend/src/app/shared/`) while only one app uses it. Nx's Angular libraries can't use the app's test runner (`vitest-angular`) unless they're separately buildable, so move UI to a library only when a second consumer appears.

## Commands (always from the repo root)

- `npm start` (`nx serve frontend`): starts the backend **and** the frontend (port 4200, which proxies `/api` to the backend, WebSockets included). The backend listens on `BACKEND_PORT` (shell or root `.env`, default 3000), and the dev proxy targets the same port. Use e.g. `BACKEND_PORT=3003` when 3000 is taken (for example by the Docker backend). The database must be running: `docker compose up -d postgres`.
- `npx nx serve backend`: backend only
- `npx nx test <project>`: unit tests (`frontend`, `backend`, `api-models`, ...)
  - one file in the backend or a library: `npx vitest run apps/backend/src/app/foo.spec.ts`
  - one file in the frontend: `npx nx test frontend --include=src/app/foo.spec.ts`
- `npx nx run backend:integration`: backend integration tests (`*.int.spec.ts`). Each test file starts the real app on its **own throwaway PostgreSQL database**, created and dropped by [test-app.ts](apps/backend/src/testing/test-app.ts), with migrations, seed and guards applied. Needs `docker compose up -d postgres`; your dev data is never touched. `nx test backend` excludes them.
- `npx nx lint <project>`, `npx nx build <project>`, `npx nx typecheck <project>`
- `npx nx e2e frontend-e2e`: Cypress (starts the frontend and backend itself; needs the database). From a VS Code terminal, prefix with `env -u ELECTRON_RUN_AS_NODE`, because VS Code sets that variable and it stops Cypress from starting.
- Screenshots for visual checks: Cypress's window is 1280 px wide, so use `cy.viewport(1280, …)` or smaller; a wider viewport gets cropped and looks like an overflow bug.
- `npm run affected`: lint, test and build only the projects affected by your changes
- `npm run format`: Prettier
- `npx nx graph`: project dependency graph
- Generate Angular code with generators (see the `angular-22` skill): `npx nx g @nx/angular:component apps/frontend/src/app/<area>/<name>/<name>`, and `npx nx g @schematics/angular:service --project=frontend --name=<name> --path=apps/frontend/src/app/core/<area>`. For Nest code use `npx nx g @nx/nest:resource|module|controller|service ...` with `--project=backend`.

Database and full stack:

- `docker compose up -d postgres`: start only the database (for local dev)
- `docker compose up --build`: whole stack; frontend at http://localhost, API at http://localhost/api
- Docker builds use the **repo root** as build context (`apps/*/Dockerfile`)

Database migrations (TypeORM CLI, via [data-source.ts](apps/backend/src/app/database/data-source.ts)):

- `npx nx run backend:migration-generate --name=AddExperience`: generate a migration from entity changes
- `npx nx run backend:migration-create --name=SeedSkills`: empty migration
- `npx nx run backend:migration-run` / `migration-revert` / `migration-show`
- **Register every new migration class** in `apps/backend/src/app/database/migrations/index.ts`. The webpack bundle can't load migration files by pattern, and a test fails if one is missing. The app runs pending migrations on startup.

## API routing

- The backend uses the **global prefix `/api`** (`apps/backend/src/main.ts`). Routes are `/api/health`, `/api/resume`, ...
- nginx ([apps/frontend/nginx.conf](apps/frontend/nginx.conf)) forwards `/api/*` to `http://backend:3000` **unchanged**. In dev, [apps/frontend/proxy.conf.mjs](apps/frontend/proxy.conf.mjs) does the same.
- The frontend always calls relative URLs: `/api/...`.
- WebSockets (Socket.IO, namespace `/live`):
  - The gateway is configured with `path: '/api/socket.io'`, and the browser connects to that same path.
  - The proxy and nginx already pass WebSocket upgrades through.

## Shared API types

- [docs/api-contract.md](docs/api-contract.md) is the source of truth.
- `libs/shared/api-models` holds the matching TypeScript interfaces, imported as `@my-resume/api-models`. Keep it **types only**, with no runtime dependencies.
- Backend DTO classes `implements` those interfaces, and frontend services return them. A contract change then breaks the build on both sides instead of failing at runtime.

## Configuration and secrets

- The root `.env` (gitignored) is used by Docker Compose: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `BACKEND_PORT`, `NODE_ENV`. Never commit or print secrets. Don't read `.env` files unless the user asks.
- The backend reads config with `@nestjs/config`, validated by [env.validation.ts](apps/backend/src/app/config/env.validation.ts): `NODE_ENV`, `PORT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and for auth:
  - `JWT_SECRET`: **required**, at least 32 characters (`openssl rand -base64 48`)
  - `PASSWORD_PEPPER`: **required**, at least 32 characters, different from `JWT_SECRET`. A server-side secret mixed into every password hash (HMAC-SHA256, then bcrypt with salt); it's never stored in the database. Changing it rebuilds the admin hash from `ADMIN_PASSWORD` on the next start.
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: optional but set together; password at least 12 characters. On startup the admin account is created or updated to match them, which is how the password is reset.
- All of them go in the root `.env` (used by both Docker Compose and local dev).
- Local dev needs no extra file. The backend loads `apps/backend/.env` (optional overrides) and then the root `.env`. Missing `DATABASE_*`/`PORT` values fall back to `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` and `BACKEND_PORT`, and `DATABASE_HOST` defaults to `localhost`. Variables already set in the shell win.
- When you add a new variable, also add it to `docker-compose.yml` and list it here.

## Backend conventions (`apps/backend`)

- **NestJS 11 rules: load the `nestjs-11` skill** ([.claude/skills/nestjs-11/SKILL.md](.claude/skills/nestjs-11/SKILL.md)) before writing backend code. It covers Express 5 route syntax, the terminus `HealthIndicatorService`/`.withTimeout()` API, secure-by-default auth with `@Public()`, TypeORM 1.x patterns and Vitest/supertest tests.
- One Nest module per resource: `src/app/<resource>/` with `<resource>.module.ts`, `.controller.ts`, `.service.ts`, `entities/`, `dto/`, and a `.spec.ts` next to the service and the controller.
- Content resources (`skills`, `experiences` with their highlights, `education`, `projects`, `profile`, and the public `resume` bundle) follow one pattern; copy it for new ones:
  - `toX()` response mappers in `dto/`
  - `UpdateXDto = PartialType(CreateXDto, { skipNullProperties: false })`, so `null` is only accepted where the field is nullable
  - `common/` helpers: `applyOrder`/`nextSortOrder` (sortOrder), `IsIsoDate`/`IsOnOrAfter`/`IsHttpUrl`/`IsSlug` validators, `slugify`, `rethrowUniqueViolation` (409)
  - linked skills via `SkillsService.findByIdsOrFail` and `orderedSkillIds`
- Create, read, update and delete behavior is tested with **integration tests** against PostgreSQL (`<resource>.int.spec.ts`, using `createTestApp()` and `api()`), not with mocked repositories. Pure logic gets unit tests.
- **Seed data:** [resume.seed.ts](apps/backend/src/app/database/seed/resume.seed.ts) holds the initial resume content, loaded once by the `SeedResume` migration into an empty database. After that, the admin panel is the source of truth; don't edit the seed to change live content.
- TypeORM with `@nestjs/typeorm`. **`synchronize: false`**. Every schema change needs a migration in `src/app/database/migrations/`.
- Global HTTP setup is in [app.setup.ts](apps/backend/src/app/app.setup.ts) (`/api` prefix and `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`), shared by `main.ts` and the e2e specs. Unknown body properties get a 400.
- Validate input with `class-validator`/`class-transformer` DTOs.
- **Auth is global** ([auth/](apps/backend/src/app/auth/)):
  - `AuthModule` installs two app-wide guards: rate limiting (300 requests/min per IP) and JWT. Every route needs a token unless marked `@Public()`, and public routes are `GET` only (login is the exception).
  - Use `@CurrentUser()` to get the token claims.
  - Tune per-route limits with `@Throttle()`.
  - `configureApp` trusts `X-Forwarded-For` from local and private-network proxies (nginx, the dev proxy), so limits apply per visitor IP. Don't publish the backend port on a public network.
- Return plain DTO-shaped JSON. Never return password hashes or internal fields.
- Use Nest exceptions (`NotFoundException`, ...), not raw errors.
- HTTP-level tests (guards, pipes, status codes) use Vitest + `supertest` against a Nest testing app, in `apps/backend/src/**/*.e2e.spec.ts`.

## Frontend conventions (`apps/frontend`)

- **Angular 22 rules: load the `angular-22` skill** ([.claude/skills/angular-22/SKILL.md](.claude/skills/angular-22/SKILL.md)) before writing Angular code. In short:
  - Services use `@Service()`, not `@Injectable({ providedIn: 'root' })`.
  - Components never set `changeDetection`: OnPush is the default, and `Eager` is not allowed.
  - Forms use signal forms, not reactive forms.
  - Lint enforces the first two ([eslint.angular.mjs](eslint.angular.mjs)). New Angular libraries must add `angular22Rules` to their ESLint config.
- Standalone components only (no NgModules).
- The app is zoneless: use signals for state, `input()`/`output()`, `inject()`, and the new control flow (`@if`, `@for`, `@defer`).
- Folder layout under `src/app/`:
  - `core/` (API services, auth, interceptors, guards, live/WebSocket service, theme, page title)
  - `layout/` (the app shell: sidebar, top bar; `nav-items.ts` is the main navigation, so add each new page there)
  - `public/` (dashboards and plain view)
  - `admin/` (lazy-loaded, protected by an auth guard)
  - `shared/` (app-only UI)
  - Reusable UI goes to a library in `libs/frontend/`.
- Use `HttpClient` through typed services in `core/` that return `@my-resume/api-models` types. Components never call `HttpClient` directly.
- Auth ([core/auth/](apps/frontend/src/app/core/auth/)):
  - `AuthService` holds the session (`isAuthenticated`, `token`, `email` signals, plus `login()`, `logout()`, `me()`).
  - `authInterceptor` adds the token to `/api` calls and handles 401.
  - Admin routes use `authGuard` (in `admin/admin.routes.ts`, under the `admin` route), and the login page uses `guestGuard`.
  - In tests, `fakeJwt()` from `core/auth/test-tokens.ts` makes tokens, and `$()` from `src/app/testing.ts` finds elements without `!`.
- Forms use **signal forms** (`@angular/forms/signals`: `form()`, `[formField]`, `[formRoot]`) by default; see the `angular-22` skill. Reactive forms only where the skill allows it (a library that needs `FormControl`, or small edits to an existing reactive form).
- Admin patterns ([admin/](apps/frontend/src/app/admin/)):
  - Lists use the generic `AdminListPage`, configured through route `data: { list }` (`list/list-configs.ts`), with `OrderedList` for reordering and deleting.
  - Edit pages use `editPage()` (`:id` or `new`, load from the list, then `page.save()` as the form's submit action, which goes back to the list) and `shared/form-utils.ts`: signal-forms rules `httpUrl(path)`, `endOnOrAfterStart(start, end)`, `showError(field())`, and `textOrNull`/`numberOrNull` for the `toRequest(model)` mappers.
  - Each page keeps its form model in a `signal()`, with pure `toModel(entity)` / `toRequest(model)` functions next to the component.
  - Skills are picked with `SkillPicker` (`[(selected)]`).
  - Content API calls go through `core/content/ContentApi`; show errors with `apiErrorMessage()`.
  - Format dates with `shared/format/period.ts` (`formatPeriod`): it reads the strings directly, never through `Date`, so time zones can't shift them.
  - Page tests use `admin/testing/render.ts` (`renderRoute`, `field(el, 'Label')`, `type()`, and `settle()` after a click so async submit actions finish) and `admin/testing/fixtures.ts`.
- Keep component styles under the budget (4kB warning per component). Load charts only when needed (`@defer` / lazy routes).
- Pages are lazy-loaded child routes of the `Shell` route in `app.routes.ts`, with a `title`. The title feeds the document title and the breadcrumb `h1`, so pages don't add their own `h1`.
- Styling: use the CSS color tokens in `apps/frontend/src/styles.scss` (`--color-*`, `--series-*`, `--space-*`), never hard-coded colors. Dark is the default; `[data-theme='light']` switches them. Shared classes: `.panel`, `.empty-state`, `.button`, `.icon-button`.
- Dashboard building blocks ([shared/panels/](apps/frontend/src/app/shared/panels/)):
  - `Panel`: frame with title, info tooltip, and a menu with View (full screen), Inspect data (JSON dialog) and an optional table view via `[(showTable)]`. Every chart needs a table alternative.
  - `EChart`: the ECharts wrapper, loading the `echarts-setup.ts` chunk on demand.
  - `StatPanel`, `BarGauge`.
  - `readChartPalette()`: chart colors from the CSS tokens, re-read when the theme changes.
- Chart options are **pure functions** (e.g. `public/overview/charts/*-option.ts`) with unit tests. Register new ECharts chart types or components in `echarts-setup.ts` only.
- In tests, provide `ECHARTS_LOADER` with a fake (jsdom has no canvas).
- Timeline, stat, gauge, impact and log panels are plain HTML/CSS/SVG.
- The dashboard view (time range and filters) lives in the URL query (`?from&to&category&skill`): read it with `parseDashboardQuery`, write it with `router.navigate(..., { queryParams: toQueryParams(q) })`.

## Test-driven development (mandatory)

All feature and bug-fix work follows red → green → refactor. Never write production code before its test exists.

1. **Write the tests first (red).**
   - Write unit tests for the feature or function, based on what it is supposed to do according to `docs/spec.md` and `docs/api-contract.md`.
   - Cover the main behavior, edge cases and error cases (validation failures, not found, unauthorized, empty lists, ...).
   - Test behavior through the public interface: inputs, outputs, HTTP responses, rendered output. Don't test private details.
2. **Run the tests and check that they fail** for the right reason: the behavior is missing, not a typo or a broken import. Only stub what's needed so the test file compiles (an empty class or a method that throws).
3. **Write the smallest amount of code that makes the tests pass (green).**
4. **If tests fail, fix the code, not the tests.**
   - Don't weaken, delete or skip a test, or change its expected values, just to get it to pass.
   - You may change a test only if it contradicts the spec or the contract, or has a real mistake. If so, say which test, why it was wrong, and what you changed.
5. **Refactor** with all tests green, then run the full suite again.
6. Bug fixes start with a test that reproduces the bug.

When reporting a task as done, list the tests you wrote first and confirm that they failed before the code was written and pass now.

## Workflow

- Build one feature at a time, with the contract first:
  1. Update `docs/api-contract.md` and `libs/shared/api-models`.
  2. Build the backend (TDD).
  3. Build the frontend (TDD).
  4. Review.
- Before calling work done, run `npx nx affected -t lint test build typecheck` (or the same targets on the projects you touched) and report any failures.
- Subagents are in `.claude/agents/`: `api-contract`, `backend-dev`, `frontend-dev`, `reviewer`.
