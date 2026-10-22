---
name: nestjs-11
description: NestJS 11 conventions and best practices for this project (myResume backend). Use whenever writing, generating, reviewing or refactoring NestJS code in apps/backend — modules, controllers, services, DTOs, TypeORM entities and migrations, guards, auth/JWT, pipes, interceptors, health checks, WebSocket gateways, config, logging and Vitest tests.
---

# NestJS 11 in myResume

The backend runs **NestJS 11.2 + Express 5, TypeORM 1.1, PostgreSQL 16, @nestjs/config 12, @nestjs/terminus 12, Vitest**, bundled with webpack by Nx. Some older NestJS habits break here: Express 4 route wildcards, the deprecated health-indicator API, and globbed migrations. Follow this skill rather than older NestJS knowledge.

Details are in the two reference files; read the one that matches your task:

- [references/nestjs-11-changes.md](references/nestjs-11-changes.md): what changed in NestJS 11 and Express 5 (routes, config, terminus, lifecycle, reflector, testing). **Read it before writing routes, middleware, health checks or config code.**
- [references/patterns.md](references/patterns.md): the patterns we use (feature modules, DI, errors, auth and guards, validation, TypeORM, WebSockets, logging, tests), with examples.

## The rules that matter most

1. **Contract first.** Routes, fields and status codes come from `docs/api-contract.md`. DTO classes `implements` the matching type from `@my-resume/api-models`. Never return entities directly; map them to response objects, and never return `passwordHash`.
2. **Test first (TDD, required by `CLAUDE.md`).** Write the `*.spec.ts` or `*.e2e.spec.ts` first, run it and see it fail, then implement. HTTP behavior is tested with `supertest` against an app configured by `configureApp()` from `app.setup.ts`, so tests use the real prefix and validation.
3. **One feature module per resource**, in `src/app/<resource>/`: module, controller, service, `entities/`, `dto/`, specs. Controllers stay thin (HTTP in, HTTP out); logic lives in services. A module exports only what other modules need.
4. **Routes:** the global prefix `/api` is added in `app.setup.ts`, so never write `api/` in `@Controller()`. Use **Express 5 path syntax**: named wildcards (`*splat`), optional parts in braces (`{.:ext}`), no `?` and no regex.
5. **Validation:** a global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` already runs, so every body, query and param needs a DTO or a `Parse*Pipe` (`ParseUUIDPipe`, `ParseIntPipe`, `ParseDatePipe`).
6. **Errors:** throw Nest HTTP exceptions (`NotFoundException`, `ConflictException`, ...) from services. Never leak stack traces, SQL or secrets in messages.
7. **Security by default:** a global JWT guard protects every route; public routes opt out with `@Public()`. Public endpoints are `GET` only. Rate-limit login and WebSocket messages.
8. **Database:** never set `synchronize`. Every schema change is a migration generated with `npx nx run backend:migration-generate --name=X` **and registered in `database/migrations/index.ts`** (a test fails otherwise). Give explicit column types. Use transactions for multi-row writes, and avoid N+1 queries.
9. **Config:** read typed values with `ConfigService<AppEnv, true>` and `get(key, { infer: true })`. New variables go into `validateEnv` (test first), `docker-compose.yml` and `CLAUDE.md`. Never log or return secrets.
10. **Health checks:** use the terminus 11+ API: `indicator.pingCheck('database').withTimeout(1500)`. Custom indicators use `HealthIndicatorService` (`check(key)`, then `.up()`/`.down()`), never `HealthIndicator`/`HealthCheckError`.

## Generating code

```bash
# full REST resource: module, controller, service, dto/, entities/, specs (also registers it in app.module.ts)
npx nx g @nx/nest:resource apps/backend/src/app/<resource>/<resource> --type=rest --crud=true
# single piece (also :controller, :module, :guard, :interceptor, ...)
npx nx g @nx/nest:service apps/backend/src/app/<resource>/<name>
```

The last path segment is the file name. Check the output against this skill. Generated routes don't include `api/`, which is correct, but the generators also produce placeholder DTOs and entities and "should be defined" specs: replace those with contract-based DTOs, typed entities and behavior tests.

## Before saying done

```bash
npx nx run-many -t lint test build typecheck -p backend   # add any library you touched
npx nx run backend:migration-show                        # when entities or migrations changed (needs: docker compose up -d postgres)
```

Report the tests written first, confirm they failed and now pass, and list new environment variables and migrations.
