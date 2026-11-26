# 0018. Edit the plain view in place, on the existing admin endpoints

- **Status:** Accepted
- **Date:** 2026-11-26
- **Related:** spec "Admin area, /admin/resume", commit d273baa

## Context

The owner wants to edit the resume as recruiters read it, without going through one form per section.

## Decision

`/admin/resume` renders the same component and layout as the public `/resume`, with fields that turn editable on click or Enter. Each change is saved straight away through the existing content endpoints (`PATCH`/`POST`/`DELETE`, `PUT …/order`): no new API, no draft or publish step. It reuses the section screens' form models for validation, and only what the plain view shows is editable there.

## Alternatives considered

- **A dedicated bulk-save endpoint:** a second write path with its own validation and cache invalidation.
- **Drafts and publishing:** a second copy of the content for a single owner.
- **A separate editor layout:** would drift from what visitors see.

## Consequences

No contract change, and the resume cache ([0013](0013-cache-public-resume.md)) is cleared by the same interceptors. Each field edit is one request; fine for one admin.
