# NestJS 11: what changed (and what to write instead)

Source: the official NestJS 11 migration guide (https://docs.nestjs.com/v11/migration-guide), checked against the versions installed in this repo.

## Express 5 is the default HTTP adapter

Path matching follows Express 5 (path-to-regexp 8):

| Express 4 (wrong now)    | Express 5 (write this)   | Notes                                          |
| ------------------------ | ------------------------ | ---------------------------------------------- |
| `@Get('files/*')`        | `@Get('files/*splat')`   | Wildcards must be named                        |
| match `/files` and below | `@Get('files{/*splat}')` | Braces make a part optional                    |
| `@Get(':file.:ext?')`    | `@Get(':file{.:ext}')`   | `?` for optional is removed                    |
| `forRoutes('*')`         | `forRoutes('{*splat}')`  | Middleware on every route, root included       |
| `@Get('ab(cd)?')`        | —                        | No regex characters; escape `()[]?+!` with `\` |

- Parameter names must be valid JS identifiers, or be quoted: `:"my-param"`.
- **Query strings:** `?ids[]=1&ids[]=2` is no longer parsed into arrays by default. Prefer `?ids=1,2` plus a DTO with `@Transform` splitting the string. Only if needed: `app.set('query parser', 'extended')` on a `NestExpressApplication`.
- **Route order:** on Express, `@Get(':id')` declared before `@Get('me')` captures `/me`. Declare static routes first, or use `ParseUUIDPipe` on `:id` so non-ids return 400.

## @nestjs/config (v4+, here v12)

- `ConfigService#get` reads in this order: internal config (`load: [...]` factories), then **validated** env values (our `validate: validateEnv` return value), then `process.env`. Internal config now **overrides** environment variables.
- `ignoreEnvVars` is deprecated → use `validatePredefined: false`. `skipProcessEnv: true` stops reading `process.env` entirely.
- In this project, `validateEnv` returns the typed `AppEnv`. Read it with `config.get('PORT', { infer: true })` on `ConfigService<AppEnv, true>`.
- `envFilePath` doesn't override variables already set in the shell, and Docker passes real environment variables.

## @nestjs/terminus (health checks)

```ts
// ✅ built-in indicator with a timeout (the `{ timeout }` option is deprecated)
check() {
  return this.health.check([() => this.db.pingCheck('database').withTimeout(1500)]);
}

// ✅ custom indicator
@Injectable()
export class QueueHealthIndicator {
  constructor(private readonly indicator: HealthIndicatorService, private readonly queue: QueueService) {}

  async isHealthy(key: string) {
    const check = this.indicator.check(key);
    const waiting = await this.queue.waitingCount();
    return waiting < 1000 ? check.up({ waiting }) : check.down({ waiting });
  }
}
```

❌ Don't write `class X extends HealthIndicator` or `throw new HealthCheckError(...)`. They're deprecated and removed in the next major.

## Lifecycle hooks and middleware order

- Termination hooks (`OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`) run in **reverse** order of initialization. Global modules are initialized first and destroyed last.
- Middleware registered in **global** modules runs first, whatever the module graph.
- `app.enableShutdownHooks()` is already called in `configureApp()`. Close resources (sockets, intervals, queues) in `onApplicationShutdown`.

## Reflector and custom decorators

- Prefer typed decorators: `export const Roles = Reflector.createDecorator<Role[]>();`, read with `this.reflector.get(Roles, context.getHandler())`.
- `getAllAndOverride` returns `T | undefined`, so handle `undefined`. `getAllAndMerge` returns an object (not a one-element array) when a single entry is an object.

## Dynamic modules ("opaque keys")

- Dynamic modules are identified by object reference, not by a hash. If the same `XModule.forRoot(...)` is imported in several places, put it in a constant and import that, or you get several instances.
- In tests that see duplicates, use `moduleRef.get(Token, { each: true })` or `Test.createTestingModule({ ... }, { moduleIdGeneratorAlgorithm: 'deep-hash' })`.

## New things worth using

- **JSON logs:** `NestFactory.create(AppModule, { logger: new ConsoleLogger({ json: true }) })` in production (one JSON object per line, easy to ingest). Keep the colored logger in development.
- **`ParseDatePipe`** for date params and queries: `@Query('from', new ParseDatePipe({ optional: true })) from?: Date`.
- **Node.js 20+** is required. This repo uses Node 24 locally and in Docker.

## NestJS 12 note

NestJS 12 is out, and this repo stays on 11 for now. Upgrading later brings:

- the Rspack builder instead of webpack
- Standard Schema validation (Zod and others)
- route-conflict detection
- removal of the deprecated terminus API

Code written to this skill (no deprecated APIs) keeps that upgrade small.
