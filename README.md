# myResume

Nobody seems to agree on whether you should build your resume for ATS (which makes it completely unreadable for humans) or for humans (which gets it systematically rejected by ATSs). So, since I'm going to make an unreadable CV anyway, I might as well make it fun.

Because why use a simple PDF file when you can over-engineer an observability-platform resume?

This site shows my career the way a monitoring tool (in the style of Grafana) shows a production system: dashboards, panels, logs, traces and a service map. A plain, printable resume is always one click away for recruiters who just want to read it.

## What you can see

| Page            | URL                        | What it shows                                                                                                                                        |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Career Overview | `/`                        | The home dashboard: stats, career timeline, skills over time, experience per skill, impact cards, technologies per year (heatmap), latest highlights |
| Explore         | `/explore`                 | Job achievements as log lines, searchable with a small LogQL-style query language, e.g. `{company="Acme"} \|= "kubernetes"`                          |
| Traces          | `/traces`, `/traces/:slug` | Each project as a trace: the project is the root span, its phases and components are child spans in a waterfall                                      |
| Service map     | `/service-map`             | A graph linking technologies, projects and jobs; clicking a node filters the dashboards                                                              |
| Plain view      | `/resume`                  | A classic one-page resume, printable and readable by screen readers and ATSs                                                                         |
| Admin           | `/admin`                   | Sign in to edit all the content (profile, experience, highlights, education, skills, projects and their spans)                                       |

The time range picker and the filters (`$company`, `$skill_category`, `$tech`) apply to every panel and are kept in the URL, so any view can be shared as a link. Every chart can also be shown as a table, and every panel has an **Inspect data** menu that shows the raw JSON behind it.

Planned next (see the build order in [docs/spec.md](docs/spec.md)): status alerts (`OpenToWork` 🔥), live site metrics streamed over WebSockets, PDF export, a quality dashboard, and an "Ask my resume" assistant.

## How it works

```
                  ┌────────────────────────────────────────────┐
 Browser ───────▶ │ nginx (frontend container)                 │
                  │  • serves the Angular app                  │
                  │  • forwards /api/* unchanged ──────────────┼──▶ NestJS backend ──▶ PostgreSQL
                  └────────────────────────────────────────────┘     (/api/...)          (content)
```

1. **The content lives in PostgreSQL.** Profile, experiences, highlights, education, skills, projects and project spans are ordinary tables, edited by the admin. The first content was seeded from my PDF resume by a database migration.
2. **The backend turns that content into dashboard data.** Nothing on the dashboards is stored as-is: years of experience, skill usage over time, the heatmap, log lines, trace waterfalls and the service map are all calculated on request by pure functions in [libs/shared/resume-metrics](libs/shared/resume-metrics). The backend loads the data, calls those functions and returns the result.
3. **The frontend only draws.** The Angular app calls one endpoint per page (for example `GET /api/dashboard?from=2019&to=2023&tech=nestjs`) and renders the panels. Stat, impact, log and trace panels are plain HTML/CSS; time series, heatmap and service map use Apache ECharts, loaded only on the pages that need it.
4. **Explore queries run on the server.** The query typed in Explore is sent as-is to `GET /api/logs`, where [libs/shared/query-parser](libs/shared/query-parser) parses it and matches it against the log lines. Because visitors write those queries, regular expressions run with `re2js` (linear time), so a nasty regex can't freeze the server. The same library powers the autocomplete in the browser.
5. **The API contract is shared.** [docs/api-contract.md](docs/api-contract.md) describes every endpoint, and [libs/shared/api-models](libs/shared/api-models) holds the matching TypeScript types. The backend DTOs implement them and the frontend services return them, so a contract change breaks the build on both sides instead of failing at runtime.

### Admin and security

- There is a single admin account, created (or updated) on every startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. No sign-up, no password reset by email: changing the variable and restarting resets the password.
- Passwords are peppered (`HMAC-SHA256` with a server secret) and then hashed with bcrypt.
- `POST /api/auth/login` returns a JWT valid for 24 hours, and is limited to 5 attempts per minute per IP.
- Every API route requires the token unless it is explicitly marked public; public routes are read-only.

### Free-hosting cold starts

In production the site runs on Render's free tier, where the backend sleeps after 15 idle minutes and takes about a minute to wake up. Instead of looking broken, the frontend shows the API as **starting**, displays a "waking up" banner, and retries failed reads for about 90 seconds so the page fills in on its own.

## Tech stack

An **Nx monorepo** with TypeScript `strict` everywhere:

| Project                                                  | Tech                                                    |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [apps/frontend](apps/frontend)                           | Angular 22 (standalone, zoneless, signals), SCSS        |
| [apps/backend](apps/backend)                             | NestJS 11, TypeORM, PostgreSQL 16                       |
| [apps/frontend-e2e](apps/frontend-e2e)                   | Cypress end-to-end tests                                |
| [libs/shared/api-models](libs/shared/api-models)         | API types shared by both apps (types only)              |
| [libs/shared/resume-metrics](libs/shared/resume-metrics) | Pure calculations behind the dashboards, logs, traces   |
| [libs/shared/query-parser](libs/shared/query-parser)     | Explore's query language: parser, matcher, autocomplete |

Unit tests use Vitest in every project. The code is written test-first.

## Running it locally

You need Node.js, npm and Docker.

1. Create a `.env` at the repo root with at least:

   ```bash
   POSTGRES_USER=resume
   POSTGRES_PASSWORD=change-me
   POSTGRES_DB=resume
   JWT_SECRET=<openssl rand -base64 48>
   PASSWORD_PEPPER=<another openssl rand -base64 48>
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=<at least 12 characters>
   ```

   The full list of variables is in [CLAUDE.md](CLAUDE.md#configuration-and-secrets).

2. Install and start:

   ```bash
   npm install
   docker compose up -d postgres   # the database
   npm start                       # backend + frontend on http://localhost:4200
   ```

   Database migrations (and the seed content) run automatically when the backend starts. If port 3000 is already taken, use `BACKEND_PORT=3003 npm start`.

To run the whole stack in Docker instead (nginx included): `docker compose up --build`, then open http://localhost.

### Useful commands

```bash
npx nx test <project>              # unit tests: frontend, backend, resume-metrics, ...
npx nx run backend:integration     # backend tests against a throwaway database
npx nx e2e frontend-e2e            # Cypress
npm run affected                   # lint, test and build what your changes affect
npx nx graph                       # see how the projects depend on each other
```

## Deployment

On every push to `main`, GitHub Actions lints, tests and builds everything, then publishes two Docker images to GHCR (`my-resume-backend` and `my-resume-frontend`) and redeploys them on Render. The same images also run on any server with Docker, behind Caddy for HTTPS. Details: [docs/deployment.md](docs/deployment.md).

## Documentation

- [docs/spec.md](docs/spec.md): the product spec, the data model and the build order
- [docs/api-contract.md](docs/api-contract.md): every endpoint and type
- [docs/deployment.md](docs/deployment.md): Docker and Render deployment
- [CLAUDE.md](CLAUDE.md): conventions for working on the code (with or without Claude Code)
