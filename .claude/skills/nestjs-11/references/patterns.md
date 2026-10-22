# NestJS patterns used in myResume

Curated for this project. Parts are adapted from [Kadajett/agent-nestjs-skills](https://github.com/Kadajett/agent-nestjs-skills) ("nestjs-best-practices", MIT license); rules that conflict with NestJS 11 were corrected (for example, the deprecated `HealthIndicator` API).

## 1. Feature modules and dependencies

```
src/app/experience/
  experience.module.ts      imports TypeOrmModule.forFeature([Experience]); exports ExperienceService only if another module needs it
  experience.controller.ts  HTTP only: params, DTOs, status codes
  experience.service.ts     business logic + repository access
  entities/experience.entity.ts
  dto/create-experience.dto.ts, update-experience.dto.ts, experience.response.ts
  experience.service.spec.ts, experience.e2e.spec.ts
```

- Organize by feature, not by technical layer (no global `services/` folder).
- No circular module imports. If two modules need each other, extract the shared part into a third module, or communicate through events (`@nestjs/event-emitter`) or the in-memory bus planned for live metrics.
- Don't "god-service": a service with many unrelated dependencies should be split.
- Cross-cutting pure logic (resume-metrics calculations, query parser) belongs in a `libs/shared/*` library, unit-tested without Nest.

## 2. Dependency injection

- **Constructor injection** with `private readonly` (the Nest idiom). Don't use property injection or `moduleRef.get()` as a service locator.
- Default **singleton** scope. Avoid `Scope.REQUEST`: it spreads to every consumer and slows the app.
- Inject abstractions with a token when a dependency has several implementations or must be swapped in tests:

```ts
export const CLOCK = Symbol('CLOCK');
export interface Clock { now(): Date }
providers: [{ provide: CLOCK, useValue: { now: () => new Date() } satisfies Clock }]
constructor(@Inject(CLOCK) private readonly clock: Clock) {}
```

Inject a clock wherever "now" matters (years of experience, "current job"), so tests are deterministic.

## 3. DTOs, validation and responses

```ts
import type { CreateExperienceRequest } from '@my-resume/api-models';

export class CreateExperienceDto implements CreateExperienceRequest {
  @IsString() @Length(1, 120) company!: string;
  @IsDateString({ strict: true }) startDate!: string; // 'YYYY-MM-DD' per contract
  @IsOptional() @IsDateString({ strict: true }) endDate?: string;
  @IsArray() @IsUUID('4', { each: true }) skillIds!: string[];
}
export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {} // from @nestjs/mapped-types
```

- Validate params with pipes: `@Param('id', ParseUUIDPipe) id: string`.
- Map entity → response in the service (`toResponse(entity): Experience`). Responses contain only contract fields. Never include `passwordHash`, internal ids or audit fields that aren't in the contract.
- Lists are sorted by `sortOrder` and capped; validate pagination or limit params.

## 4. Errors

- Services throw HTTP exceptions with safe messages: `throw new NotFoundException(\`Experience ${id} not found\`)`.
- Translate database errors at the edge. A unique violation (`23505`) becomes `ConflictException`; never expose driver messages. If this repeats, add a global exception filter.
- Always `await` (or return) promises. A floating promise loses errors, and ESLint warns about it.

## 5. Auth and authorization (build step 2)

- **Secure by default:** register a global guard and mark public routes.

```ts
export const Public = Reflector.createDecorator<boolean>(); // @Public() on GET handlers

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(Public, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const token = ctx
      .switchToHttp()
      .getRequest<Request>()
      .headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException();
    try {
      await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
// app.module: providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

- `@nestjs/jwt` with `JWT_SECRET` from validated config (at least 32 characters), a short expiry (1 day per the spec), and an explicit `algorithms: ['HS256']`.
- Passwords: `bcrypt` with cost ≥ 12, and compare in constant time (bcrypt does). Login failures return a generic "Invalid credentials".
- **Rate limiting** with `@nestjs/throttler`: strict on `POST /api/auth/login` (e.g. 5/min per IP), looser globally. Behind nginx, trust the proxy so the real IP is used (`app.set('trust proxy', 1)` on Express).
- Health and public `GET` endpoints are `@Public()`. Write tests asserting **401 without a token** for every write route.

## 6. TypeORM 1.x

```ts
@Entity('experience')
export class Experience {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120 }) company!: string;
  @Column({ type: 'date' }) startDate!: string; // keep 'YYYY-MM-DD' strings, no Date timezone shifts
  @Column({ type: 'date', nullable: true }) endDate!: string | null;
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
  @ManyToMany(() => Skill) @JoinTable() skills!: Skill[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
```

- **Explicit column types**: they make the migrations predictable.
- Register entities with `TypeOrmModule.forFeature([...])` (`autoLoadEntities` is on). Inject repositories with `@InjectRepository(Experience)`.
- **N+1:** load relations in one query (`relations: { skills: true }` or a query builder join). Never query in a loop.
- **Transactions** for multi-row writes (reorder, replace highlights): `await this.dataSource.transaction(async (manager) => { ... })`, using only `manager` inside.
- **Migrations:** generate with `npx nx run backend:migration-generate --name=AddExperience`, review the SQL, and add the class to `database/migrations/index.ts`. Never edit a migration that has already run; add a new one. Seed data uses `migration-create`.
- Add indexes for columns used in filters and sorts (`sortOrder`, foreign keys, `date` ranges for dashboard queries).

## 7. WebSockets (build step 8)

- `@WebSocketGateway({ path: '/api/socket.io', namespace: '/live' })` with `@nestjs/platform-socket.io`.
- Validate every incoming message with a DTO (`@UsePipes(new ValidationPipe(...))` on the handler) and limit how often each client can send messages.
- Push aggregates, never personal visitor data (no IP addresses or user agents). Use one room per channel and clean up on `handleDisconnect`.

## 8. Logging and shutdown

- Use `new Logger(MyService.name)` in classes. Never `console.log`.
- Never log secrets, tokens, passwords or full request bodies.
- In production, use the JSON `ConsoleLogger` (see nestjs-11-changes.md).
- Long-running work (intervals, sockets) stops in `onApplicationShutdown`.

## 9. Tests (Vitest)

- **Unit:** `Test.createTestingModule({ providers: [Service, { provide: getRepositoryToken(Entity), useValue: repoMock }] })`, where `repoMock` is built from `vi.fn()`. Assert on behavior: returned values, thrown exceptions, and calls that matter (e.g. `save` called with the mapped entity).
- **HTTP (e2e):** create the app with `moduleRef.createNestApplication()`, call `configureApp(app)`, then `app.init()`, and use `supertest`. Cover 200/201/204, 400 (validation, unknown fields), 401 (no token), 404, and 409.
- Override providers instead of reaching into internals: `.overrideProvider(TypeOrmHealthIndicator).useValue(...)`, `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` (only in tests that aren't about auth).
- Freeze time with an injected `CLOCK` or `vi.useFakeTimers()`, and restore it in `afterEach`.
- Close the app in `afterAll(() => app.close())`.
- Decorator metadata works under Vitest here (Vite 8 + oxc), so `Test.createTestingModule` resolves constructor injection without extra setup.
