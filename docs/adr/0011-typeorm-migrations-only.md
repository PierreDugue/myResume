# 0011. TypeORM with explicit migrations and a one-time seed

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** `.claude/rules/backend.md` "Database"

## Context

The database holds live content edited through the admin. The backend is bundled with webpack, which can't load migration files by glob pattern.

## Decision

- TypeORM with `synchronize: false`. Every schema change is a migration in `src/app/database/migrations/`, **registered in `migrations/index.ts`** (a test fails if one is missing). Pending migrations run on startup.
- The initial content comes from `resume.seed.ts`, loaded once by the `SeedResume` migration into an empty database. After that the admin panel is the source of truth.

## Alternatives considered

- **`synchronize: true`:** can drop columns on live data.
- **Prisma / Drizzle:** TypeORM is the Nest default, with `@nestjs/typeorm` and its testing patterns.
- **Seed on every start:** would overwrite the owner's edits.

## Consequences

Schema changes are reviewable and reversible. Every migration must be safe to run on live data.
