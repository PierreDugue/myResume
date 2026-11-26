# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

Decisions were spread across `docs/spec.md` ("Technical choices"), `CLAUDE.md`, `.claude/rules/` and commit messages. They said _what_ we do, rarely _why_, and almost never what was rejected. The architect agent writes an "Alternatives" section for every design, but it was lost once the feature was built.

## Decision

Keep Architecture Decision Records in `docs/adr/`, one Markdown file per decision, numbered `NNNN-kebab-title.md`, from [template.md](template.md), listed in [README.md](README.md).

- An ADR is immutable once accepted. To change a decision, write a new ADR and mark the old one `Superseded by NNNN`.
- The architect decides, in each design, whether the feature needs an ADR, and drafts it; the main session writes it once the feature is reviewed (see `CLAUDE.md`, Workflow).
- The reviewer flags a structural change that has no ADR.

## Alternatives considered

- **Keep decisions only in the spec:** the spec describes the product as it is; it has no place for rejected options or history.
- **A wiki or external doc:** drifts from the code; agents can't read it.

## Consequences

The rules and CLAUDE.md stay the short "how to" for agents; ADRs hold the "why". An ADR adds a small step to each significant feature.
