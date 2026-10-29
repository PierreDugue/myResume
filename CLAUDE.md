# myResume

Personal resume site presented as an observability platform (inspired by Grafana). Anyone can view the public pages; a single admin (the owner) logs in to edit the content.
The product spec is in [docs/spec.md](docs/spec.md) and the API contract in [docs/api-contract.md](docs/api-contract.md). Read both before starting a feature.

Area-specific conventions are in `.claude/rules/` and load when you work on matching files: [backend.md](.claude/rules/backend.md) (`apps/backend`), [frontend.md](.claude/rules/frontend.md) (`apps/frontend`, e2e, `libs/frontend`), [deployment.md](.claude/rules/deployment.md) (Docker, nginx, CI).

## Stack

**Nx 23.3 monorepo** (integrated): one root `package.json` and one `node_modules`. TypeScript is `strict` everywhere.

| Project        | Tech                                                      | Path                      |
| -------------- | --------------------------------------------------------- | ------------------------- |
| `frontend`     | Angular 22 (standalone, zoneless, signals), SCSS, esbuild | `apps/frontend`           |
| `frontend-e2e` | Cypress end-to-end tests                                  | `apps/frontend-e2e`       |
| `backend`      | NestJS 11, TypeORM, webpack build                         | `apps/backend`            |
| Database       | PostgreSQL 16                                             | Docker service `postgres` |

**Unit tests use Vitest in every project**: the frontend through `@angular/build:unit-test`, the backend and the libraries through `@nx/vitest`.

Put code used by more than one app in `libs/`, created with Nx generators, never by hand:

- `npx nx g @nx/js:library libs/shared/<name> --importPath=@my-resume/<name> --bundler=none --unitTestRunner=vitest`
- `npx nx g @nx/angular:library libs/frontend/<name> --unitTestRunner=vitest-angular` for Angular UI libraries. Angular UI stays in the app (`apps/frontend/src/app/shared/`) until a second app needs it: Nx's Angular libraries can't use the app's test runner unless they're separately buildable.

Libraries (unit-test every rule in them, with hand-checkable fixtures):

- `libs/shared/api-models` (`@my-resume/api-models`): the API types. **Types only**, no runtime dependencies.
- `libs/shared/resume-metrics` (`@my-resume/resume-metrics`): pure calculations behind the public pages (`buildDashboard`, `buildLogs`, `buildTrace`/`buildTraces`, `buildServiceMap`, month arithmetic, the span outline rules shared with the admin form). Fixtures in `src/lib/fixtures.ts`.
- `libs/shared/query-parser` (`@my-resume/query-parser`): Explore's LogQL-style query language (`parseQuery`, `compileQuery`, `suggest`/`applySuggestion`, `withLabelMatcher`). Visitors' queries run on the server, so regexes run with `re2js` in linear time: **never use `RegExp` on query input**.

## Commands (always from the repo root)

- `npm start` (`nx serve frontend`): starts the backend **and** the frontend (port 4200, which proxies `/api` to the backend, WebSockets included). The backend listens on `BACKEND_PORT` (default 3000); use e.g. `BACKEND_PORT=3003` when 3000 is taken (for example by the Docker backend). Needs the database: `docker compose up -d postgres`.
- `npx nx serve backend`: backend only
- `npx nx test <project>`: unit tests (`frontend`, `backend`, `api-models`, ...)
  - one file in the backend or a library: `npx vitest run apps/backend/src/app/foo.spec.ts`
  - one file in the frontend: `npx nx test frontend --include=apps/frontend/src/app/foo.spec.ts` (the full path from the repo root)
- `npx nx run backend:integration`: backend integration tests (`*.int.spec.ts`), each file on its own throwaway database; your dev data is never touched. Needs `docker compose up -d postgres`. `nx test backend` excludes them.
- `npx nx lint|build|typecheck <project>`, `npm run affected` (lint, test and build what your changes affect), `npm run format` (Prettier), `npx nx graph`
- `npx nx e2e frontend-e2e`: Cypress (starts the frontend and backend itself; needs the database). From a VS Code terminal, prefix with `env -u ELECTRON_RUN_AS_NODE`, because VS Code sets that variable and it stops Cypress from starting.
- Generate code with generators: `npx nx g @nx/angular:component apps/frontend/src/app/<area>/<name>/<name>`, `npx nx g @schematics/angular:service --project=frontend --name=<name> --path=apps/frontend/src/app/core/<area>`, and `npx nx g @nx/nest:resource|module|controller|service ... --project=backend`.
- `docker compose up --build`: whole stack locally; frontend at http://localhost, API at http://localhost/api. Deployment: [docs/deployment.md](docs/deployment.md).

## API routing

- The backend uses the **global prefix `/api`**. Routes are `/api/health`, `/api/resume`, ...
- The frontend always calls relative URLs (`/api/...`). nginx in Docker ([nginx.conf.template](apps/frontend/nginx.conf.template)) and the dev proxy ([proxy.conf.mjs](apps/frontend/proxy.conf.mjs)) forward them **unchanged**, WebSocket upgrades included.
- WebSockets: Socket.IO, namespace `/live`, on `path: '/api/socket.io'` for both the gateway and the browser.

## Shared API types

- [docs/api-contract.md](docs/api-contract.md) is the source of truth, and `@my-resume/api-models` holds the matching interfaces.
- Backend DTO classes `implements` them, and frontend services return them. A contract change then breaks the build on both sides instead of failing at runtime.

## Configuration and secrets

Never commit or print secrets. Don't read `.env` files unless the user asks.

- Everything goes in the root `.env` (gitignored), used by Docker Compose and local dev. The backend also loads `apps/backend/.env` (optional overrides) first. Variables already set in the shell win.
- The backend validates its config in [env.validation.ts](apps/backend/src/app/config/env.validation.ts):
  - `NODE_ENV`, `PORT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`. In local dev they fall back to `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` and `BACKEND_PORT`, and `DATABASE_HOST` to `localhost`.
  - `DATABASE_SSL`: optional, `true` or `false` (default). `true` connects over SSL and checks the server certificate, as hosted databases such as Neon require. The compose files set it to `false` for their bundled `postgres` container.
  - `JWT_SECRET` and `PASSWORD_PEPPER`: **required**, at least 32 characters (`openssl rand -base64 48`), different from each other. Changing the pepper rebuilds the admin hash from `ADMIN_PASSWORD` on the next start.
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: optional, set together, password at least 12 characters. On startup the admin account is created or updated to match them, which is how the password is reset.
  - `PROXY_SECRET`: optional, at least 32 base64/hex characters, different from the other secrets. Same value on the backend and the frontend container; only needed where nginx reaches the backend through a public address (Render).
- Containers only: `BACKEND_URL` (frontend: where nginx sends `/api`, default `http://backend:3000`), `REAL_IP_PROXIES` (frontend: the proxies nginx trusts to report the visitor's IP, `private` by default, `cloudflare` on Render), and for `docker-compose.prod.yml`, `IMAGE_TAG` (default `latest`) and `DOMAIN` (required: the site's domain, for Caddy's HTTPS certificate).
- When you add a variable, add it to `docker-compose.yml` (and `docker-compose.prod.yml` if production needs it) and list it here.

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
- Subagents are in `.claude/agents/`: `architect` (plans a feature and decides which of the others to use), `api-contract`, `backend-dev`, `frontend-dev`, `reviewer`.
