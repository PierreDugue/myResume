# 0004. Compute dashboards on the server in a pure shared library

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** spec "Data model, calculated values", commit ee18004

## Context

Every public page (dashboard, logs, traces, service map) derives values from the same resume: years per skill, timelines, stats. A few rules (month arithmetic, span outline rules) are also needed in the browser, by the timeline and the admin project form.

## Decision

Put all these calculations in `libs/shared/resume-metrics` as pure, framework-free functions (`buildDashboard`, `buildLogs`, `buildTrace(s)`, `buildServiceMap`, month arithmetic, span outline rules), unit-tested with hand-checkable fixtures (`src/lib/fixtures.ts`). The backend calls them and sends ready-to-draw data (`GET /api/dashboard` is one call for every panel); the frontend only draws, and reuses the few rules it needs.

## Alternatives considered

- **Calculate in the browser from `GET /api/resume`:** bigger payloads and bundles, and the rules would run with no server-side check.
- **Calculate in SQL:** hard to test and to read; the data set is small enough for memory.
- **Keep the code in a Nest service:** the frontend couldn't reuse the rules without copying them.

## Consequences

The rules are easy to test (and mutation-tested, [0010](0010-tdd-agents-and-mutation-testing.md)). Each public request recomputes from the resume, which is why the resume is cached ([0013](0013-cache-public-resume.md)).
