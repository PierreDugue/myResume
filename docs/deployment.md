# Deployment

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) publishes two images on every push to `main`:

- `ghcr.io/pierredugue/my-resume-backend`
- `ghcr.io/pierredugue/my-resume-frontend`

Both are tagged `latest` and `sha-<short commit>`.

## Any server with Docker

HTTPS is handled by **Caddy**, the only service reachable from outside. It gets a free Let's Encrypt certificate and renews it, redirects `http://` to `https://`, and forwards to nginx.

Before the first start:

1. **A domain name** pointing to the server: an `A` record (and `AAAA` for IPv6) with the server's IP. A free subdomain (e.g. DuckDNS) works too.
2. **Ports 80 and 443 open** in the server's firewall, and in the cloud provider's network rules (on Oracle, the VCN security list). Let's Encrypt checks the domain over port 80.
3. **A `.env`** next to [docker-compose.prod.yml](../docker-compose.prod.yml). It needs the same variables as local Docker (see the configuration section of `CLAUDE.md`), plus `DOMAIN=resume.example.com`.

Then run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

To roll back, set `IMAGE_TAG=sha-<short commit>` and run the same commands.

The certificate is stored in the `caddy_data` volume. Don't delete that volume: without it, every restart asks Let's Encrypt for a new certificate, and Let's Encrypt limits how often you can do that.

## Render (two free web services)

Render provides HTTPS itself, with a free certificate on the `onrender.com` address and on custom domains, and redirects `http://` to `https://`. Caddy isn't used there.

Render runs each image as its own **web service**. A free web service can't receive traffic from Render's private network. nginx therefore reaches the backend through the backend's public HTTPS address.

### 1. Make the images public (once)

On GitHub, open **Profile → Packages → my-resume-backend → Package settings → Change visibility → Public**. Do the same for `my-resume-frontend`.

The images contain no secrets; those are environment variables set on Render. You can keep the images private instead, but then Render needs a registry credential: a GitHub token with `read:packages`.

### 2. Create the backend service

**New → Web Service → Existing image**, with:

| Setting       | Value                                          |
| ------------- | ---------------------------------------------- |
| Image URL     | `ghcr.io/pierredugue/my-resume-backend:latest` |
| Instance type | Free                                           |
| Health check  | `/api/health`                                  |
| Region        | Same region for both services and the database |

Set these environment variables:

| Variable                                                                                | Value                                                                                                 |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                              | `production`                                                                                          |
| `JWT_SECRET`                                                                            | `openssl rand -base64 48`                                                                             |
| `PASSWORD_PEPPER`                                                                       | another `openssl rand -base64 48`                                                                     |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                                         | your admin login (password at least 12 characters)                                                    |
| `PROXY_SECRET`                                                                          | `openssl rand -base64 48`, the **same value** as on the frontend service                              |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | from the database's connection string (for Neon: the **direct** one, connection pooling off)          |
| `DATABASE_SSL`                                                                          | `true` for Neon (it only accepts SSL connections); leave unset for Render Postgres's internal address |

Don't set `PORT`. Render sets it, and the backend listens on it. Migrations and the seed run on the first start.

With `PROXY_SECRET` set, the backend's own `onrender.com` address answers `403` to everything except `/api/health`. Only requests that come through nginx carry the secret. This is expected: use the frontend's address.

### 3. Create the frontend service

**New → Web Service → Existing image**, with:

| Setting       | Value                                           |
| ------------- | ----------------------------------------------- |
| Image URL     | `ghcr.io/pierredugue/my-resume-frontend:latest` |
| Instance type | Free                                            |
| Health check  | `/`                                             |

Set these environment variables:

| Variable          | Value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`     | The backend's address from its Render page, e.g. `https://my-resume-backend.onrender.com` (no trailing slash) |
| `REAL_IP_PROXIES` | `cloudflare`: Render sits behind Cloudflare, so nginx must skip Cloudflare's addresses to find the visitor    |
| `PROXY_SECRET`    | The same value as on the backend                                                                              |

The site is the frontend's address. Visitors only ever use that address.

### 4. Redeploy automatically from CI

Render doesn't redeploy when a new image is pushed.

1. For each service, copy **Settings → Deploy Hook**.
2. Add the hooks as GitHub repository secrets, under **Settings → Secrets and variables → Actions**:
   - `RENDER_DEPLOY_HOOK_BACKEND`
   - `RENDER_DEPLOY_HOOK_FRONTEND`

After publishing the images, CI calls both hooks with that commit's `sha-…` image. Without the secrets, CI skips this step.

### Link previews (LinkedIn, Slack, ...)

`index.html` has Open Graph tags with the image [public/og-image.png](../apps/frontend/public/og-image.png) (1200×627, a screenshot of the overview dashboard). Crawlers need absolute URLs, so nginx replaces `__SITE_ORIGIN__` with `https://` plus the domain the request came in on: nothing to configure. Before sharing a link, open the site so it is awake (a crawler gives up long before a cold start ends), then paste the link into LinkedIn's Post Inspector (linkedin.com/post-inspector), which also refreshes a preview LinkedIn has cached.

### Known limits on Render

- **Cold starts.** A free service sleeps after 15 minutes without traffic. The first visit then waits about a minute for the frontend, then again for the backend.
- **750 free hours a month,** shared by the workspace. Sleeping services don't use any.
- **Rate limits per visitor IP depend on `PROXY_SECRET`.** The backend is reached through Render twice. On its own it would see Render's address for every visitor, so all visitors would share one count. With the secret, nginx works out the visitor's IP and vouches for it.
  - nginx reads the visitor's IP from the right of `X-Forwarded-For` and skips the proxies it trusts: Render's private `10.x` proxy, and Cloudflare, which is in front of every Render service. That's why the frontend needs `REAL_IP_PROXIES=cloudflare` (the ranges are in [nginx/real-ip/](../apps/frontend/nginx/real-ip/)). Addresses a visitor adds themselves are ignored.
  - **Check after the first deploy:** in the frontend's Render logs, each request line starts with the visitor's IP. Sign in and look for your own public IP there. If you see a Cloudflare address instead (`162.158.x`, `172.64.x` to `172.71.x`, `104.16.x` to `104.27.x`, ...), `REAL_IP_PROXIES` isn't set to `cloudflare`, or Cloudflare has added ranges: update [cloudflare.conf](../apps/frontend/nginx/real-ip/cloudflare.conf) from cloudflare.com/ips.
  - **Rotating the secret:** change it on both services, then redeploy both. Requests fail in between.
