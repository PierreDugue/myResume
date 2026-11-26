# 0008. Zoneless Angular with signals, RxJS for async work

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** `.claude/skills/angular-22/SKILL.md`, `.claude/rules/frontend.md`

## Context

Angular 22 is zoneless and OnPush by default, and offers signal forms. Dashboards react to URL state, live sockets and HTTP calls that must be cancellable (filters change quickly).

## Decision

- Standalone, zoneless components; state in signals; `@Service()`; no `changeDetection` setting (lint enforces both).
- Async work is RxJS: services return `Observable<T>`, components end in a signal (`toSignal`, `rxResource`, or `subscribe` + `takeUntilDestroyed`). Promises only at promise-based APIs.
- Signal forms for every form; components never call `HttpClient`, only typed services in `core/`.
- Dashboard view state (time range, filters) lives in the URL query.

## Alternatives considered

- **Zone.js with default change detection:** slower and on its way out.
- **Promises / `async`-`await` in services:** no cancellation when a filter changes; harder to combine with sockets.
- **Reactive forms:** more code than signal forms for the same validation.

## Consequences

Tests use zoneless patterns (no `fakeAsync`). Shareable deep links come for free.
