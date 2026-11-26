# 0002. Use an Nx integrated monorepo

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** commit 20c80f0

## Context

The site has an Angular frontend, a NestJS backend, Cypress tests and calculations needed by both sides. One developer, assisted by AI agents, changes both sides in the same feature.

## Decision

One Nx 23.3 integrated monorepo: one root `package.json` and `node_modules`, TypeScript `strict` everywhere. Code used by more than one project goes to `libs/`, created with Nx generators. Libraries never import from apps, apps never import from each other.

## Alternatives considered

- **Two repositories (frontend, backend):** API types would be copied or published as a package, and a contract change would only fail at runtime.
- **Plain npm/pnpm workspaces:** no project graph, no `affected`, no generators or caching.

## Consequences

A contract change breaks the build on both sides at once ([0003](0003-contract-first-shared-api-types.md)). `nx affected` keeps local checks fast; CI runs every project. All projects share one dependency version set, so upgrading Angular or Nest is a repo-wide change.
