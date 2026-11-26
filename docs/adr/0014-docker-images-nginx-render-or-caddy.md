# 0014. Ship Docker images behind nginx, on Render or any Docker host

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** `docs/deployment.md`, `.claude/rules/deployment.md`, commits c861829, 8e87816

## Context

The site must be cheap to host and easy to move between providers, with HTTPS and strict security headers.

## Decision

- Two images (backend, frontend with nginx), built by GitHub Actions for amd64 and arm64, published to GHCR as `latest` and `sha-<commit>`, deployed by Render deploy hooks once every check passes.
- nginx serves the frontend and forwards `/api` (WebSockets included) **unchanged** to `BACKEND_URL`, sends the security headers (strict CSP, so no inline scripts) and the visitor's IP.
- Hosting: Render (two web services) or any server with `docker-compose.prod.yml` and Caddy for HTTPS. PostgreSQL in the compose file or hosted (Neon, `DATABASE_SSL=true`).
- The backend and PostgreSQL are never exposed to the network.

## Alternatives considered

- **Serve the frontend from NestJS:** couples the two deploys and loses nginx's headers and caching.
- **Kubernetes / a PaaS-specific build:** too much for one small site; images keep providers interchangeable.

## Consequences

Rollback is redeploying an older `sha-` tag. On Render, nginx reaches the backend through a public address, hence [0015](0015-proxy-secret-for-public-backend.md).
