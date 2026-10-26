---
paths:
  - 'apps/backend/**'
---

# Backend conventions (`apps/backend`)

Load the `nestjs-11` skill ([.claude/skills/nestjs-11/SKILL.md](../skills/nestjs-11/SKILL.md)) before writing backend code. It covers Express 5 route syntax, the terminus health API, secure-by-default auth with `@Public()`, TypeORM 1.x patterns and Vitest/supertest tests. This file holds what's specific to this codebase.

## Structure

- One Nest module per resource: `src/app/<resource>/` with `<resource>.module.ts`, `.controller.ts`, `.service.ts`, `entities/`, `dto/`, and a `.spec.ts` next to the service and the controller.
- Content resources (`skills`, `experiences` with their highlights, `education`, `projects`, `profile`, and the public `resume` bundle) follow one pattern; copy it for new ones:
  - `toX()` response mappers in `dto/`
  - `UpdateXDto = PartialType(CreateXDto, { skipNullProperties: false })`, so `null` is only accepted where the field is nullable. For a non-nullable optional field, use `@IsOptionalButNotNull()`, not `@IsOptional()`.
  - `common/` helpers: `applyOrder`/`nextSortOrder` (sortOrder), `IsIsoDate`/`IsOnOrAfter`/`IsHttpUrl`/`IsSlug` validators, `slugify`, `rethrowUniqueViolation` (409)
  - linked skills via `SkillsService.findByIdsOrFail` and `orderedSkillIds`
- Global HTTP setup is in [app.setup.ts](../../apps/backend/src/app/app.setup.ts) (`/api` prefix and `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`), shared by `main.ts` and the e2e specs. Unknown body properties get a 400.
- Validate input with `class-validator`/`class-transformer` DTOs. Return plain DTO-shaped JSON; never return password hashes or internal fields. Use Nest exceptions (`NotFoundException`, ...), not raw errors.

## Tests

- Create, read, update and delete behavior is tested with **integration tests** against PostgreSQL (`<resource>.int.spec.ts`, using `createTestApp()` and `api()` from [test-app.ts](../../apps/backend/src/testing/test-app.ts)), not with mocked repositories. Each test file gets its own throwaway database. Pure logic gets unit tests.
- HTTP-level tests (guards, pipes, status codes) use Vitest + `supertest` against a Nest testing app, in `apps/backend/src/**/*.e2e.spec.ts`. `ConfigModule` copies validated values into `process.env`, so a test that sets an optional variable must delete it afterwards.

## Database

- TypeORM with `@nestjs/typeorm`, **`synchronize: false`**. Every schema change needs a migration in `src/app/database/migrations/` (TypeORM CLI via [data-source.ts](../../apps/backend/src/app/database/data-source.ts)):
  - `npx nx run backend:migration-generate --name=AddExperience`: from entity changes
  - `npx nx run backend:migration-create --name=SeedSkills`: empty migration
  - `npx nx run backend:migration-run` / `migration-revert` / `migration-show`
- **Register every new migration class** in `src/app/database/migrations/index.ts`. The webpack bundle can't load migration files by pattern, and a test fails if one is missing. The app runs pending migrations on startup.
- **Seed data:** [resume.seed.ts](../../apps/backend/src/app/database/seed/resume.seed.ts) holds the initial resume content, loaded once by the `SeedResume` migration into an empty database. After that, the admin panel is the source of truth; don't edit the seed to change live content.

## Auth ([auth/](../../apps/backend/src/app/auth/))

- `AuthModule` installs three app-wide guards, in this order:
  1. `TrustedProxyGuard`: only active when `PROXY_SECRET` is set (see below).
  2. Rate limiting (`ClientIpThrottlerGuard`, 300 requests/min per visitor IP). Tune per route with `@Throttle()`.
  3. JWT. Every route needs a token unless marked `@Public()`, and public routes are `GET` only (login is the exception). Use `@CurrentUser()` to get the token claims.
- `configureApp` trusts `X-Forwarded-For` from local and private-network proxies (nginx, the dev proxy), so limits apply per visitor IP. Don't publish the backend port on a public network.
- Where the backend has a public address (Render), `PROXY_SECRET` is shared with nginx, which sends it in `X-Proxy-Secret` with the visitor IP in `X-Client-IP`:
  - Requests without the secret get `403`, except routes marked `@AllowDirectAccess()` (only `GET /api/health`, for platform health checks).
  - With a valid secret, rate limits count per `X-Client-IP`. Without `PROXY_SECRET`, both headers are ignored.
  - A future WebSocket gateway must apply the same check to its handshake.
- Passwords: HMAC-SHA256 with `PASSWORD_PEPPER`, then bcrypt with salt. The admin account is created or updated from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on startup.
