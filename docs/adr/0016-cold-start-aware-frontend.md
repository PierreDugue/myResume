# 0016. Make backend cold starts visible instead of failing

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** spec "Cross-cutting requirements, Cold starts", commits 369a522, 8838167, d42c11b

## Context

Render's free plan put the backend to sleep after 15 idle minutes, and waking it took about a minute. The plan is now paid and the backend no longer sleeps, but a deploy or a restart still takes it down for up to a minute.

## Decision

- The sidebar's API status (`GET /api/health`) shows **starting** after 3 s without an answer or on a 502/503/504 that didn't come from the backend, checks every 5 s while starting, and reports **down** after 2 minutes. It only checks while the tab is visible.
- A banner says the backend is waking up and the page will load by itself.
- Failed `GET /api/...` calls (502/503/504) are retried with increasing delays for about 90 s. Writes are never retried.

## Alternatives considered

- **A keep-alive ping:** would only cover idle sleep, not deploys and restarts.
- **Remove the handling now that the plan is paid:** deploys and restarts still cause the same gap.

## Consequences

Pages fill in by themselves after a restart. Hidden tabs send no health checks.
