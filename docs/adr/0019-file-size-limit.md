# 0019. One responsibility per file, with an 800-line backstop

- **Status:** Accepted
- **Date:** 2026-11-26
- **Related:** `CLAUDE.md` "File size", `tools/file-size`

## Context

Most of the code is written by agents, which tend to keep adding to the file they are in: one spec had grown to 1908 lines. Such files mix several responsibilities, are hard to review, and make an agent read a lot of unrelated code for a small change.

Line count is only a proxy for that. A cohesive file of 600 lines is easier to work with, for people and agents, than the same code spread over several files that call each other. A strict limit low enough to force a design discussion (300) would also force splits that make the code worse.

## Decision

- The rule is **one responsibility per file**. Source files and tests (`.ts`, `.js`/`.mjs`/`.cjs`, `.html`, `.scss`/`.css`) are usually around 500 lines; that is a goal, not a limit. Docs, JSON, YAML and shell scripts are not checked.
- Over **800 lines fails the build**, as a backstop against files that grow without anyone deciding it. `tools/file-size` (an Nx project, run with Node's type stripping like `tools/quality-report`) holds the rule; `nx run file-size:check` checks every file git knows about, and every `build` depends on it (`nx.json` `targetDefaults`), so local builds and CI fail.
- A Claude Code `PostToolUse` hook on Write/Edit (`.claude/settings.json`) applies the same limit to the edited file and tells the agent at once.
- Between 500 and 800, judgement decides: before adding to such a file, check it still does one thing, and the `reviewer` agent says so for every changed file over 500 lines.

## Alternatives considered

- **ESLint `max-lines`:** one rule instead of a tool, shown in the editor, and CI's lint job would still block deploys; but it doesn't check SCSS, fails lint rather than the build, and the agent only hears about it when it runs lint. Reasonable; we may switch to it later.
- **Only the Claude hook:** wouldn't stop a human edit or another tool, and CI wouldn't see it.
- **A strict limit at 600, aiming for 300 (the first version of this ADR):** forced splitting cohesive files, and the extra files and imports cost as much reading as they saved.

## Consequences

The check reads every file on each build (under a second). A file that reaches 800 must be split before the next build passes. A legitimately large generated or data file would need an exclusion in `isChecked`.
