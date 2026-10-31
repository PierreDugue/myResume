---
paths:
  - 'docker-compose*.yml'
  - 'apps/*/Dockerfile'
  - '.dockerignore'
  - 'apps/frontend/nginx.conf.template'
  - '.github/**'
  - 'docs/deployment.md'
---

# Docker, CI and deployment

The human-facing guide is [docs/deployment.md](../../docs/deployment.md); keep it in sync with changes here.

## Docker

- Docker builds use the **repo root** as build context (`apps/*/Dockerfile`).
- Never expose the backend or PostgreSQL to the network: `docker-compose.yml` (local) binds their ports to `127.0.0.1`, and `docker-compose.prod.yml` (server) publishes only Caddy.
- nginx ([nginx.conf.template](../../apps/frontend/nginx.conf.template)) is a template: the nginx image fills in environment variables at startup (only ones that are set, so nginx's own `$vars` stay). It:
  - forwards `/api/*` unchanged to `BACKEND_URL`, with the backend's own `Host` and TLS name (Render routes by hostname) and a DNS `resolver`, so the address is looked up again;
  - gets the visitor IP from `X-Forwarded-For`, skipping the proxies listed in `apps/frontend/nginx/real-ip/<REAL_IP_PROXIES>.conf` (`private` by default, `cloudflare` on Render), and sends it as `X-Client-IP` with `X-Proxy-Secret` (see the backend rules). [test-real-ip.sh](../../apps/frontend/nginx/test-real-ip.sh) tests this against the real nginx image (in CI too); extend it when you change these files;
  - replaces `__SITE_ORIGIN__` in `index.html` with `https://$host` (`sub_filter`), for the Open Graph tags' absolute URLs (also tested by `test-real-ip.sh`);
  - sends the security headers (CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`). nginx drops server-level `add_header`s in a location that sets its own, so locations must not use `add_header`.

## CI (`.github/workflows/`)

- [ci.yml](../../.github/workflows/ci.yml) is the entry point. Every push and pull request runs these jobs in parallel: lint + typecheck, unit tests, the backend integration tests (against a throwaway PostgreSQL service), nginx's visitor-IP test (`apps/frontend/nginx/test-real-ip.sh`), build backend, build frontend. Node jobs share the [setup](../../.github/actions/setup/action.yml) composite action (Node 24 + `npm ci`).
- On `main`, once every check passes, it calls [publish.yml](../../.github/workflows/publish.yml) (reusable): the two images go to GHCR, `ghcr.io/pierredugue/my-resume-backend` and `-frontend`, tagged `latest` and `sha-<short commit>`. Each image is built for `linux/amd64` and `linux/arm64` on native runners, then combined.
- Then it calls [deploy.yml](../../.github/workflows/deploy.yml) (reusable, `secrets: inherit`): the Render deploy hooks (`RENDER_DEPLOY_HOOK_BACKEND`, `RENDER_DEPLOY_HOOK_FRONTEND` repository secrets) with that commit's image, skipped when they aren't set. It can also be run by hand with a `tag` input to redeploy or roll back.
- Called workflows must not reuse the caller's concurrency group (it deadlocks); deploy.yml uses its own `deploy-render` group.
- Check workflow changes with `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`.

## Deploying

- **Own server:** [docker-compose.prod.yml](../../docker-compose.prod.yml) runs the published images (no build), with a `.env` next to it. Caddy gets a Let's Encrypt certificate for `DOMAIN`, redirects HTTP to HTTPS and forwards to nginx. `IMAGE_TAG=sha-<short commit>` rolls back.
- **Render:** two free web services from the images. nginx reaches the backend through its public HTTPS address (`BACKEND_URL`), with `PROXY_SECRET` set on both. Render provides HTTPS.
- To test the production compose locally, use `DOMAIN=localhost` (Caddy then uses its own local certificates) and override the published ports in an extra compose file with `ports: !override`.
