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

- `npm start` (`nx serve frontend`): starts the backend (port 3000) **and** the frontend (port 4200, which proxies `/api` to the backend, WebSockets included)
- `npx nx serve backend`: backend only
- `npx nx test <project>`: unit tests (`frontend`, `backend`, `api-models`, ...)
  - one file in the backend or a library: `npx vitest run apps/backend/src/app/foo.spec.ts`
  - one file in the frontend: `npx nx test frontend --include=src/app/foo.spec.ts`
- `npx nx lint <project>`, `npx nx build <project>`, `npx nx typecheck <project>`
- `npx nx e2e frontend-e2e`: Cypress (starts the app itself)
- `npm run affected`: lint, test and build only the projects affected by your changes
- `npm run format`: Prettier
- `npx nx graph`: project dependency graph
- Generate Angular code with Nx generators: `npx nx g @nx/angular:component apps/frontend/src/app/<path>/<name>` (also `:service`, ...). For Nest code use `npx nx g @nx/nest:resource|module|controller|service ...` with `--project=backend`.

Database and full stack:

- `docker compose up -d postgres`: start only the database (for local dev)
- `docker compose up --build`: whole stack; frontend at http://localhost, API at http://localhost/api
- Docker builds use the **repo root** as build context (`apps/*/Dockerfile`)

## API routing

- The backend uses the **global prefix `/api`** (`apps/backend/src/main.ts`). Routes are `/api/health`, `/api/resume`, ...
- nginx ([apps/frontend/nginx.conf](apps/frontend/nginx.conf)) forwards `/api/*` to `http://backend:3000` **unchanged**. In dev, [apps/frontend/proxy.conf.json](apps/frontend/proxy.conf.json) does the same.
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
- The backend reads config with `@nestjs/config` from environment variables: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `PORT`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- For local dev outside Docker, put these in `apps/backend/.env` (gitignored) with `DATABASE_HOST=localhost`.
- When you add a new variable, also add it to `docker-compose.yml` and list it here.

## Backend conventions (`apps/backend`)

- One Nest module per resource: `src/app/<resource>/` with `<resource>.module.ts`, `.controller.ts`, `.service.ts`, `entities/`, `dto/`, and a `.spec.ts` next to the service and the controller.
- TypeORM with `@nestjs/typeorm`. **`synchronize: false`**. Every schema change needs a migration in `src/app/database/migrations/`.
- Validate input with `class-validator`/`class-transformer` DTOs and a global `ValidationPipe({ whitelist: true, transform: true })`.
- Public endpoints are `GET` only. Every write endpoint is protected by the JWT auth guard.
- Return plain DTO-shaped JSON. Never return password hashes or internal fields.
- Use Nest exceptions (`NotFoundException`, ...), not raw errors.
- HTTP-level tests (guards, pipes, status codes) use Vitest + `supertest` against a Nest testing app, in `apps/backend/src/**/*.e2e.spec.ts`.

## Frontend conventions (`apps/frontend`)

- Standalone components only (no NgModules); `ChangeDetectionStrategy.OnPush`.
- The app is zoneless: use signals for state, `input()`/`output()`, `inject()`, and the new control flow (`@if`, `@for`, `@defer`).
- Folder layout under `src/app/`:
  - `core/` (API services, auth, interceptors, guards, live/WebSocket service)
  - `public/` (dashboards and plain view)
  - `admin/` (lazy-loaded, protected by an auth guard)
  - `shared/` (app-only UI)
  - Reusable UI goes to a library in `libs/frontend/`.
- Use `HttpClient` through typed services in `core/` that return `@my-resume/api-models` types. Components never call `HttpClient` directly.
- Use reactive forms for admin editing screens.
- Keep component styles under the budget (4kB warning per component). Load charts only when needed (`@defer` / lazy routes).

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
