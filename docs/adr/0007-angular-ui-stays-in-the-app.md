# 0007. Keep Angular UI in the app until a second app needs it

- **Status:** Accepted
- **Date:** 2026-10-31
- **Related:** `CLAUDE.md` "Stack"; amends the spec's planned `libs/frontend/ui-panels`

## Context

The spec planned the panel components (`Panel`, `EChart`, ...) in a `libs/frontend/ui-panels` library. Nx's Angular libraries can't use the app's test runner (`@angular/build:unit-test`) unless they are separately buildable, and only one app uses them.

## Decision

Angular UI lives in `apps/frontend/src/app/shared/` (panels in `shared/panels/`). It moves to a library in `libs/frontend/` only when a second app needs it.

## Alternatives considered

- **A buildable Angular library now:** a second build and test setup to maintain for no current reuse.

## Consequences

One test setup for all Angular code. Moving the components later costs a generator run and import updates.
