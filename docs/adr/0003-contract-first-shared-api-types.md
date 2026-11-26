# 0003. Contract-first API with a types-only shared library

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

The frontend and backend are built by different agents, often in parallel. They need one source of truth for routes, fields and error cases.

## Decision

- `docs/api-contract.md` is the source of truth, written before any code (owned by the `api-contract` agent).
- `libs/shared/api-models` (`@my-resume/api-models`) holds the matching interfaces. **Types only**, no runtime dependencies.
- Backend DTO classes `implements` these interfaces; frontend services return them.

## Alternatives considered

- **Generate types from OpenAPI (Swagger decorators):** the contract would follow the code instead of leading it, and adds a codegen step.
- **Share DTO classes with class-validator decorators:** would pull backend runtime dependencies into the frontend bundle.

## Consequences

Contract drift becomes a compile error. Validation rules still live twice (backend DTOs, frontend forms), so the contract must state them.
