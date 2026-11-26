# 0010. Mandatory TDD through specialized agents, checked by mutation testing

- **Status:** Accepted
- **Date:** 2026-11-24
- **Related:** `CLAUDE.md` "Test-driven development", `.claude/agents/`, commits 7f260ff, 73b9958, 60eac97, 18a0b22

## Context

About 95% of the code is generated with Claude Code. Tests are the spec an agent can run. Early on, TDD produced too many tests, tests that couldn't fail, and "red" runs that only proved a whole feature was missing. Implementing agents were also tempted to change tests to make them pass.

## Decision

- Red → green → refactor is mandatory; bug fixes start with a reproducing test.
- Work is split between agents: `architect` designs and plans, `api-contract` writes the contract, `tester` writes the failing tests, `backend-dev` / `frontend-dev` make them pass **without changing them**, `reviewer` checks the result.
- `utest-reviewer` prunes tests that can't fail or don't matter, and StrykerJS mutation testing runs on `query-parser` and `resume-metrics`, with the agent triaging surviving mutants.
- All unit tests use Vitest; CRUD behavior is tested by integration tests against PostgreSQL (each file on its own throwaway database), not mocked repositories; journeys in Cypress.

## Alternatives considered

- **One agent writes tests and code:** tests end up fitted to the implementation.
- **Coverage as the quality gate:** high coverage with tests that assert nothing.
- **Mocked repositories for CRUD:** miss constraint, migration and query bugs.

## Consequences

More steps per feature, and integration tests need the `postgres` container. Mutation testing is slow, so it runs on the pure libraries only.
