# Architecture Decision Records

Why the codebase is the way it is. The spec ([docs/spec.md](../spec.md)) says what the product does; `CLAUDE.md` and `.claude/rules/` say how to work in the code; an ADR records **one decision, its context and the options rejected**.

## When to write one

Write an ADR when a change:

- adds a dependency, a library, a framework or an external service;
- adds or changes a boundary: a new Nx project, a new layer, a new public interface between modules;
- sets a pattern the next features must follow (or changes an existing one);
- makes a security, data, hosting or cost trade-off;
- rejects an obvious alternative for a reason that isn't visible in the code.

Don't write one for a feature that only follows existing patterns, a bug fix, or a local refactor.

## How

1. Copy [template.md](template.md) to `NNNN-kebab-title.md` (next free number).
2. Fill it in: context, decision, alternatives, consequences. Keep it under a page.
3. Add it to the index below.
4. Accepted ADRs are not rewritten. To change a decision, write a new ADR and set the old one's status to `Superseded by [NNNN](...)`. Fixing a typo or a broken link is fine.

In the agent workflow ([CLAUDE.md](../../CLAUDE.md), Workflow), the `architect` says in each design whether an ADR is needed and drafts it from its "Alternatives" section; the main session writes the file after review, and the `reviewer` flags structural changes without one.

## Index

ADRs 0002 to 0018 were written on 2026-11-26 from the spec, the rules and the git history. Their dates are the commits that introduced each decision, and some of their rejected alternatives were reconstructed rather than recorded at the time.

| #                                                            | Decision                                                     | Status   | Date       |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- | ---------- |
| [0001](0001-record-architecture-decisions.md)                | Record architecture decisions                                | Accepted | 2026-11-26 |
| [0002](0002-nx-integrated-monorepo.md)                       | Use an Nx integrated monorepo                                | Accepted | 2026-10-22 |
| [0003](0003-contract-first-shared-api-types.md)              | Contract-first API with a types-only shared library          | Accepted | 2026-10-22 |
| [0004](0004-resume-calculations-in-shared-library.md)        | Compute dashboards on the server in a pure shared library    | Accepted | 2026-10-23 |
| [0005](0005-server-side-query-language-with-re2js.md)        | Parse visitor queries on the server, regexes with re2js      | Accepted | 2026-10-23 |
| [0006](0006-echarts-wrapper-and-plain-html-panels.md)        | ECharts through our own wrapper; simple panels in plain HTML | Accepted | 2026-10-23 |
| [0007](0007-angular-ui-stays-in-the-app.md)                  | Keep Angular UI in the app until a second app needs it       | Accepted | 2026-10-31 |
| [0008](0008-angular-zoneless-signals-rxjs.md)                | Zoneless Angular with signals, RxJS for async work           | Accepted | 2026-10-22 |
| [0009](0009-single-admin-secure-by-default-auth.md)          | One admin from env variables, JWT, secure by default         | Accepted | 2026-10-22 |
| [0010](0010-tdd-agents-and-mutation-testing.md)              | Mandatory TDD through agents, checked by mutation testing    | Accepted | 2026-11-24 |
| [0011](0011-typeorm-migrations-only.md)                      | TypeORM with explicit migrations and a one-time seed         | Accepted | 2026-10-22 |
| [0012](0012-in-process-site-metrics-and-socketio.md)         | Sample the process in memory, stream it over Socket.IO       | Accepted | 2026-11-06 |
| [0013](0013-cache-public-resume.md)                          | Cache the public resume in memory, cleared on every write    | Accepted | 2026-11-14 |
| [0014](0014-docker-images-nginx-render-or-caddy.md)          | Docker images behind nginx, on Render or any Docker host     | Accepted | 2026-10-23 |
| [0015](0015-proxy-secret-for-public-backend.md)              | Require a proxy secret where the backend is public           | Accepted | 2026-10-26 |
| [0016](0016-cold-start-aware-frontend.md)                    | Make backend cold starts visible instead of failing          | Accepted | 2026-11-18 |
| [0017](0017-gemini-assistant-behind-llmclient.md)            | "Ask my resume" with Gemini behind LlmClient, without RAG    | Accepted | 2026-11-24 |
| [0018](0018-in-place-resume-editor-on-existing-endpoints.md) | Edit the plain view in place, on existing admin endpoints    | Accepted | 2026-11-26 |
| [0019](0019-file-size-limit.md)                              | Limit source files to 600 lines, aiming for 300              | Accepted | 2026-11-26 |
