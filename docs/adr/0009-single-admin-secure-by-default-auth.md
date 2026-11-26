# 0009. One admin from environment variables, JWT, secure by default

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** spec "Auth", `.claude/rules/backend.md`, commit 56e8a24

## Context

Only the owner edits content; visitors are anonymous and read-only. There is no email service, and the API is public on the internet.

## Decision

- One admin account, created or updated on every startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; changing the variable and restarting resets the password. No sign-up, no reset by email.
- Passwords: `HMAC-SHA256(PASSWORD_PEPPER, password)`, then bcrypt (cost 12). The pepper stays outside the database, and long passwords aren't cut at bcrypt's 72 bytes.
- `POST /api/auth/login` returns a JWT (HS256, 24 h), 5 attempts per minute per IP, same answer for unknown email and wrong password.
- A global JWT guard: every route needs a token unless marked `@Public()`, and public routes are `GET` only (login and `POST /api/assistant/ask` excepted). A global rate limit of 300 requests/min per visitor IP.
- The frontend keeps the token in memory and `localStorage`; a 401 signs out.

## Alternatives considered

- **Users table with sign-up and roles:** out of scope (one admin).
- **Session cookies:** needs CSRF protection; a bearer token on `/api` calls only is simpler here.
- **OAuth provider (GitHub, Google):** an external dependency for one account.

## Consequences

Forgetting `@Public()` fails closed. A stolen token is valid until it expires (no revocation list), accepted for one admin.
