# 0013. Cache the public resume in memory, cleared on every write

- **Status:** Accepted
- **Date:** 2026-11-14
- **Related:** commit a30154e, `apps/backend/src/app/resume/resume-cache.ts`

## Context

Every public read endpoint (resume, dashboard, logs, traces, service map) needs the whole resume, which costs five queries, while it only changes when the admin edits content.

## Decision

`ResumeCache` keeps the resume in the Nest cache (`@nestjs/cache-manager`) with a 60 s TTL. Every content write clears it through `InvalidateResumeCacheInterceptor`. Concurrent readers share one pending load, and a load that started before a write is not stored (a generation counter), so this instance is never stale.

## Alternatives considered

- **`cache.wrap()`:** could store the old resume right after an invalidation.
- **Redis:** one instance, no need for a shared cache.
- **HTTP caching headers only:** the admin's edit would not show up at once.

## Consequences

Public pages cost no database query most of the time. The TTL bounds staleness for another instance or a direct database edit. A new content module must import `ResumeCacheModule` and apply the interceptor to its writes.
