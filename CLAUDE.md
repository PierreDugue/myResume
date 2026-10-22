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

Planned libraries:

- `libs/shared/query-parser`: the log query parser, used by the backend to filter and by the frontend for autocomplete
- `libs/frontend/ui-panels`: the dashboard panel components

## Commands (always from the repo root)

- `npm start` (`nx serve frontend`): starts the backend **and** the frontend (port 4200, which proxies `/api` to the backend, WebSockets included). The backend listens on `BACKEND_PORT` (shell or root `.env`, default 3000), and the dev proxy targets the same port. Use e.g. `BACKEND_PORT=3003` when 3000 is taken (for example by the Docker backend). The database must be running: `docker compose up -d postgres`.
- `npx nx serve backend`: backend only
- `npx nx test <project>`: unit tests (`frontend`, `backend`, `api-models`, ...)
  - one file in the backend or a library: `npx vitest run apps/backend/src/app/foo.spec.ts`
  - one file in the frontend: `npx nx test frontend --include=src/app/foo.spec.ts`
- `npx nx lint <project>`, `npx nx build <project>`, `npx nx typecheck <project>`
- `npx nx e2e frontend-e2e`: Cypress (starts the frontend and backend itself; needs the database). From a VS Code terminal, prefix with `env -u ELECTRON_RUN_AS_NODE`, because VS Code sets that variable and it stops Cypress from starting.
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
- The backend reads config with `@nestjs/config`, validated by [env.validation.ts](apps/backend/src/app/config/env.validation.ts): `NODE_ENV`, `PORT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`. Coming with auth: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Local dev needs no extra file. The backend loads `apps/backend/.env` (optional overrides) and then the root `.env`. Missing `DATABASE_*`/`PORT` values fall back to `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` and `BACKEND_PORT`, and `DATABASE_HOST` defaults to `localhost`. Variables already set in the shell win.
- When you add a new variable, also add it to `docker-compose.yml` and list it here.

## Backend conventions (`apps/backend`)

- **NestJS 11 rules: load the `nestjs-11` skill** ([.claude/skills/nestjs-11/SKILL.md](.claude/skills/nestjs-11/SKILL.md)) before writing backend code. It covers Express 5 route syntax, the terminus `HealthIndicatorService`/`.withTimeout()` API, secure-by-default auth with `@Public()`, TypeORM 1.x patterns and Vitest/supertest tests.
- One Nest module per resource: `src/app/<resource>/` with `<resource>.module.ts`, `.controller.ts`, `.service.ts`, `entities/`, `dto/`, and a `.spec.ts` next to the service and the controller.
- TypeORM with `@nestjs/typeorm`. **`synchronize: false`**. Every schema change needs a migration in `src/app/database/migrations/`.
- Global HTTP setup is in [app.setup.ts](apps/backend/src/app/app.setup.ts) (`/api` prefix and `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`), shared by `main.ts` and the e2e specs. Unknown body properties get a 400.
- Validate input with `class-validator`/`class-transformer` DTOs.
- Public endpoints are `GET` only. Every write endpoint is protected by the JWT auth guard.
- Return plain DTO-shaped JSON. Never return password hashes or internal fields.
- Use Nest exceptions (`NotFoundException`, ...), not raw errors.
- HTTP-level tests (guards, pipes, status codes) use Vitest + `supertest` against a Nest testing app, in `apps/backend/src/**/*.e2e.spec.ts`.

## Frontend conventions (`apps/frontend`)

- **Angular 22 rules: load the `angular-22` skill** ([.claude/skills/angular-22/SKILL.md](.claude/skills/angular-22/SKILL.md)) before writing Angular code. In short:
  - Services use `@Service()`, not `@Injectable({ providedIn: 'root' })`.
  - Components never set `changeDetection`: OnPush is the default, and `Eager` is not allowed.
  - Lint enforces both ([eslint.angular.mjs](eslint.angular.mjs)). New Angular libraries must add `angular22Rules` to their ESLint config.
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
- Use reactive forms for admin editing screens.
- Keep component styles under the budget (4kB warning per component). Load charts only when needed (`@defer` / lazy routes).
- Pages are lazy-loaded child routes of the `Shell` route in `app.routes.ts`, with a `title`. The title feeds the document title and the breadcrumb `h1`, so pages don't add their own `h1`.
- Styling: use the CSS color tokens in `apps/frontend/src/styles.scss` (`--color-*`, `--series-*`, `--space-*`), never hard-coded colors. Dark is the default; `[data-theme='light']` switches them. Shared classes: `.panel`, `.empty-state`, `.button`, `.icon-button`.
- Charts: Apache ECharts through our own small wrapper component (planned in `libs/frontend/ui-panels`). Stat, gauge, logs and trace panels are plain HTML/CSS/SVG.

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
