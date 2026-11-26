# 0019. Limit source files to 600 lines, aiming for 300

- **Status:** Accepted
- **Date:** 2026-11-26
- **Related:** `CLAUDE.md` "File size", `tools/file-size`

## Context

Most of the code is written by agents, which tend to keep adding to the file they are in. One spec had grown to 1908 lines. Big files are hard to review, cost agents more context to read, and usually mix several responsibilities.

## Decision

- Source files and tests (`.ts`, `.js`/`.mjs`/`.cjs`, `.html`, `.scss`/`.css`) aim for about 300 lines and must not go over 600. Docs, JSON, YAML and shell scripts are not checked.
- `tools/file-size` (an Nx project, run with Node's type stripping like `tools/quality-report`) holds the rule. `nx run file-size:check` checks every file git knows about, and every `build` depends on it (`nx.json` `targetDefaults`), so local builds and CI fail on a file over 600.
- A Claude Code `PostToolUse` hook on Write/Edit (`.claude/settings.json`) applies the same rule to the edited file and reports it to the agent at once.
- The 300-line target is guidance in `CLAUDE.md`, not enforced.

## Alternatives considered

- **ESLint `max-lines`:** only covers the files ESLint lints (no SCSS), has a single level, and fails lint, not the build.
- **Only the Claude hook:** wouldn't stop a human edit or another tool; CI wouldn't see it.
- **Fail at 300:** about 20 existing files are between 300 and 600, many of them focused specs or data that are fine as they are.

## Consequences

The check reads every file on each build (under a second). An existing file that reaches 600 must be split before the next build passes. A legitimately large generated file would need an exclusion in `isChecked`.
