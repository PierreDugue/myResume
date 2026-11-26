# 0015. Require a proxy secret where the backend has a public address

- **Status:** Accepted
- **Date:** 2026-10-26
- **Related:** `.claude/rules/backend.md` "Auth", commit c7b9047

## Context

On Render, nginx reaches the backend through its public HTTPS address. Anyone could call the backend directly, skip nginx's headers, and forge `X-Forwarded-For` to dodge the per-IP rate limits.

## Decision

An optional `PROXY_SECRET`, set on both containers. nginx sends it in `X-Proxy-Secret`, with the visitor IP in `X-Client-IP`. When it is set, `TrustedProxyGuard` (the first global guard) refuses requests without it (`403`), except `@AllowDirectAccess()` routes (only `GET /api/health`), and rate limits count per `X-Client-IP`. The WebSocket handshake applies the same check. Without `PROXY_SECRET`, both headers are ignored.

## Alternatives considered

- **Private networking between services:** not available on Render's free plan.
- **IP allow-list of nginx:** Render's outbound IPs are shared and change.

## Consequences

Local and self-hosted setups don't need it. The secret must stay in sync on both services.
