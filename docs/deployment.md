# Deployment

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) publishes two images on every push to `main`:

- `ghcr.io/pierredugue/my-resume-backend`
- `ghcr.io/pierredugue/my-resume-frontend`

Both are tagged `latest` and `sha-<short commit>`.

## Any server with Docker

Put a `.env` next to [docker-compose.prod.yml](../docker-compose.prod.yml). It needs the same variables as local Docker; see the configuration section of `CLAUDE.md`. Then run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

To roll back, set `IMAGE_TAG=sha-<short commit>` and run the same commands.

## Render (two free web services)

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
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | from the database, which is to be decided (Render Postgres works as is; Neon needs SSL support first) |

Don't set `PORT`. Render sets it, and the backend listens on it. Migrations and the seed run on the first start.

### 3. Create the frontend service

**New → Web Service → Existing image**, with:

| Setting       | Value                                           |
| ------------- | ----------------------------------------------- |
| Image URL     | `ghcr.io/pierredugue/my-resume-frontend:latest` |
| Instance type | Free                                            |
| Health check  | `/`                                             |

Set one environment variable:

| Variable      | Value                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL` | The backend's address from its Render page, e.g. `https://my-resume-backend.onrender.com` (no trailing slash) |

The site is the frontend's address. Visitors only ever use that address.

### 4. Redeploy automatically from CI

Render doesn't redeploy when a new image is pushed.

1. For each service, copy **Settings → Deploy Hook**.
2. Add the hooks as GitHub repository secrets, under **Settings → Secrets and variables → Actions**:
   - `RENDER_DEPLOY_HOOK_BACKEND`
   - `RENDER_DEPLOY_HOOK_FRONTEND`

After publishing the images, CI calls both hooks with that commit's `sha-…` image. Without the secrets, CI skips this step.

### Known limits on Render

- **Cold starts.** A free service sleeps after 15 minutes without traffic. The first visit then waits about a minute for the frontend, then again for the backend.
- **750 free hours a month,** shared by the workspace. Sleeping services don't use any.
- **Rate limits per visitor IP don't work yet.** Requests reach the backend through Render twice, so it sees Render's address for every visitor, and all visitors share one count (including the login limit). Fixing this needs a backend change: nginx would pass the real IP with a shared secret, and the backend would reject requests that don't come through nginx.
- **The backend's `onrender.com` address is public.** Anyone can call it directly and skip nginx and its security headers. Writes still need the admin token. The fix above would also close this.
