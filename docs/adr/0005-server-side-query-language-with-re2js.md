# 0005. Parse visitor queries on the server and run regexes with re2js

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** spec "Explore", commit 9e64a44

## Context

Explore has a LogQL-style query language (`{company="Acme"} |= "kubernetes"`, `=~` regex matchers). Queries come from anonymous visitors and run on the server, and later will filter the live log stream too. JavaScript's `RegExp` backtracks, so a crafted pattern can block the event loop (ReDoS).

## Decision

- `libs/shared/query-parser` (`@my-resume/query-parser`) holds the parser, compiler, autocomplete and label helpers, shared by the backend and the Explore page.
- The query is parsed and matched on the server (`GET /api/logs`), like real log tools.
- Regexes run with `re2js`, in linear time. **Never use `RegExp` on query input.**

## Alternatives considered

- **Native `RegExp` with a timeout:** JavaScript can't interrupt a running regex.
- **Filter in the browser only:** works for highlights, not for the server's live stream.
- **No regex support:** loses the `=~` matchers that make the language look real.

## Consequences

Safe to expose publicly. re2js has no backreferences or lookarounds; the language doesn't promise them.
