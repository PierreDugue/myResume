# myResume — Product spec

## Goal

A personal resume site that looks and works like an **observability platform** (in the style of Grafana).

- My career is shown as dashboards, panels, logs and traces, so the presentation itself shows technical skill.
- The site also **monitors itself for real**: its own live metrics appear next to the resume, so the observability theme isn't just a costume.
- The site owner logs into an admin area to edit all content.
- A **plain view** and a PDF download are always one click away, so recruiters can still read a normal resume quickly.

> Design note: the site is "Grafana-inspired" only, not a copy. No Grafana logo, name or branding. It has its own name (working title: **"Pierre O11y"**) and its own color palette, with a dark dashboard theme by default and a light theme option.

## Users

- **Visitor:** anonymous; read-only access to the public pages. The usual visitors are recruiters, hiring managers and engineers.
- **Admin:** the site owner; a single account. Can create, edit and delete all content and reorder lists.

## Concept: the resume as data you can monitor

| Observability idea                                      | Resume meaning                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Time range picker (e.g. "Last 10 years", "2019 → 2022") | Career timeline. Changing it filters **every** panel.                     |
| Metrics and time series                                 | How my use of each skill changed over time                                |
| Logs                                                    | Achievements and highlights from each job, as log lines                   |
| Traces                                                  | A project shown as a trace: phases and components as spans in a waterfall |
| Service map                                             | How technologies, projects and jobs connect                               |
| Alerts                                                  | Status, e.g. 🔥 `OpenToWork` firing, or ✅ `Employed` OK                  |
| Variables (dropdowns)                                   | Filters: `$company`, `$skill_category`, `$tech`                           |
| Contact points                                          | How to reach me (email, LinkedIn, GitHub)                                 |
| Live mode / streaming                                   | The site's real activity, pushed live over WebSockets                     |

## Public site

Layout: a sidebar on the left (navigation and theme switch) and a top bar with a breadcrumb, time range picker, variables, refresh button, **"Plain view"** toggle and **"Export PDF"** button.

The refresh control has these settings: `Off`, `5s`, `30s`, `1m` and **`Live`**.

- `Live` subscribes to a WebSocket stream, so panels update without reloading.
- A pulsing "● LIVE" badge shows the connection state: connected, reconnecting or offline.

### 1. Home dashboard `/` ("Career Overview")

A grid of panels. Each panel has a title, an info tooltip, and a menu with **View** (full screen) and **Inspect data** (shows the raw JSON behind the panel, a nod to engineers).

- **Stat panels:**
  - years of experience
  - jobs
  - projects shipped
  - technologies
  - "uptime since <first job year>"
  - current status (open to work or not)
- **Impact panels:** the quantified achievements from the resume shown as before/after metrics, like a performance-goal improvement. Each one shows a big value with an arrow and a percent change, and a small "before → after" step chart. Examples:
  - "Page load time: −35%"
  - "Test coverage: <20% → 75%+"
  - "Production regressions: −60%"
  - "Checkout conversion: +20%"
  - "Onboarding time: −50%"
- **State timeline:** jobs and education shown as colored bars on the career timeline.
  - **Gaps between jobs aren't highlighted.** No "no data" markers, no red or empty-state styling, and no "gap" labels.
  - The axis is continuous and quiet, and bars are evenly sized and in calm colors.
  - Jobs and education are on separate rows, so periods without a job don't stand out.
  - Stat values (years of experience) use the resume's own figures ("14+ years in IT", "9+ years of Angular"), not a sum of job durations.
- **Time series:** skill usage over time. One line per skill (or per category), calculated from the jobs and projects that used it. Clicking a line in the legend shows only that skill.
- **Bar gauge:** skill levels grouped by category.
- **Heatmap:** technologies used per year, like a GitHub contribution graph.
- **Logs panel (preview):** the latest highlights, with a link to Explore.
- **Profile panel:** photo, headline, summary and links, shown as a text panel.

### 2. Explore `/explore` (logs)

- A query bar with a small, LogQL-style query language. Examples:
  - `{company="Acme"} |= "kubernetes"`
  - `{level="achievement"}`
  - `{type="education"}`
- Autocomplete for labels and values, plus example queries to click.
- Results appear as log lines, for example `2023-04-12  ACHIEVEMENT  [acme/backend] Cut API p95 latency by 40% by ...`. A line can be expanded to show its labels (company, role, technologies).
- A bar chart above the results shows how many matching log lines there are over time.
- This is a good place to show off: the query parser is real code with full unit tests.
- **Live tail tab:** streams the site's **real** request log over WebSocket as it happens.
  - Example line: `14:02:11  INFO  [api] GET /dashboard/stats 200 12ms  visitor=FR`.
  - It has pause/resume and clear buttons and a level filter.
  - It keeps at most 500 lines (the oldest are dropped).
  - The same query language filters the live stream on the server.

### 3. Traces `/traces/:projectSlug`

- Each project is shown as a trace waterfall. The root span is the whole project; child spans are phases or components (design, API, frontend, CI/CD, ...), each with a duration, technology tags and a note.
- A project list page shows them all as a "trace search" table.

### 4. Service map `/service-map`

- A node graph: technologies ↔ projects ↔ jobs. Node size grows with how much experience I have.
- Clicking a node filters the dashboards by that technology.

### 5. Alerts `/alerting`

- Status and fun alert rules. Examples:
  - `OpenToWork` firing or OK
  - `RelocationPossible`
  - `LearningNewSkill`, firing with what I'm currently learning
- A "Contact points" tab lists my contact links.

### 6. Live site metrics `/dashboards/meta` ("This site, observed")

**Real** monitoring of this application. The backend is instrumented with OpenTelemetry and Prometheus metrics. Panels show:

- requests per second
- p50 and p95 API latency
- error rate
- visits per day
- how long since the last deploy (uptime)
- (optional) a real trace of the request that loaded the page you're looking at

- In `Live` mode, these panels are fed by WebSocket: the server pushes one aggregated data point per second, and the charts scroll in real time.
- A **"Visitors right now"** stat shows the number of open WebSocket connections.
- A **live event stream** shows the latest events across the site, e.g. "someone opened /traces/acme-platform", "PDF downloaded".

**Privacy:**

- No personal data about visitors is stored or streamed: no IP addresses, no full user agent, and no request bodies or headers.
- Only aggregated counts, the HTTP method, the route pattern (e.g. `/projects/:slug/trace`, not query strings), the status code, the response time and (optionally) a coarse country are kept.
- Admin routes and `/auth/*` are never shown in the live streams.

### 7. Quality dashboard `/dashboards/quality` ("This codebase, observed")

Shows the site's own engineering quality. The data comes from the build pipeline, which writes a JSON report that the backend serves. Panels:

- unit and e2e test counts and pass rate
- code coverage per project (frontend, backend, libraries)
- bundle size compared with its budget
- Lighthouse scores (performance, accessibility, best practices, SEO)
- build duration and date of the last deploy
- the Nx project graph (apps and libraries)

This backs up the resume's claims about testing and performance with live numbers.

### 8. How this site was built `/about-this-site`

A short page, in the same dashboard style, about how the site was engineered:

- **Architecture:** Nx monorepo (Angular 22 + NestJS + shared libraries), Docker, nginx, WebSockets, OpenTelemetry.
- **AI-assisted development:** built with Claude Code using specialized agents (API contract, backend, frontend, reviewer), mandatory test-driven development, and a contract-first workflow. Links to `CLAUDE.md`, the agent definitions and the spec on the public repository, if it's public.
- **Decisions:** a few short architecture decision notes, e.g. "Why Nx", "Why Socket.IO", "Why ECharts".

This connects to the resume's AI skills (Claude, Claude skills) and to "Generate 95% of code with Claude".

### 9. Plain view `/resume`

- A classic one-page resume (profile, experience, projects, skills, education).
- Printable, easy to read for screen readers and applicant-tracking software, with a link to download the original PDF.
- Every dashboard page has a link to it.

### Cross-cutting requirements

- **Responsive:** on mobile, panels stack in a single column.
- **Accessible:** chart data can also be shown as a table, panels can be reached with the keyboard, and color is never the only signal.
- **Fast:** the home dashboard loads in under 2 seconds, and chart libraries are only loaded on the pages that use them.
- **Deep links:** the URL keeps the time range and variable choices (e.g. `/?from=2019&to=2023&tech=nestjs`) so a view can be shared.
- **Live data is optional:**
  - Every page works without WebSockets. If the socket can't connect, it retries with increasing delays and falls back to normal HTTP refresh.
  - Streams only run while a page that needs them is visible; they pause when the browser tab is hidden.
- **Cold starts:** free hosting (Render) puts the backend to sleep after 15 idle minutes, and waking it takes about a minute. The frontend makes this visible instead of looking broken:
  - The sidebar's API status (from `GET /api/health`) shows **starting** when the health check takes more than 3 seconds, or when it gets a 502, 503 or 504 that didn't come from the backend (a 503 health report from the backend itself means **down**). While starting, it checks every 5 seconds, and it reports **down** after 2 minutes without an answer.
  - While the API is starting, a banner above the page says the backend is waking up and that the page will load by itself.
  - Failed `GET /api/...` calls (502, 503 or 504) are retried with increasing delays for about 90 seconds, so pages fill in once the backend is up. Writes (`POST`, `PUT`, `PATCH`, `DELETE`) are never retried.
- **First visit:** an optional short guided tour explains the concept: "This resume is an observability platform. Try changing the time range…"

## Admin area

- `/admin/login`: email and password form.
- `/admin`: a list of all content sections.
- One screen per section to list items, create, edit, delete and reorder them:
  - Profile
  - Experience and its highlights
  - Education
  - Skills
  - Projects and their spans
  - Alerts/status
- **Resume PDF:** upload a PDF file; the latest one is offered as "Export PDF" on the public site.
- **Import from PDF (later):** read text out of the uploaded PDF to pre-fill content, which the owner then checks and edits. The first content will be entered by hand or with a seed script based on the owner's PDF.

## Data model

All tables have `id` (uuid), `createdAt` and `updatedAt`. Lists use `sortOrder` (int) so the admin can choose the display order. Dates are stored as `date` and sent in the API as `YYYY-MM-DD`.

| Entity                       | Fields                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Profile** (one row)        | fullName, headline, summary, email, phone?, showPhone (bool, default **false**, so the phone appears only in the PDF), location?, openToRelocation (bool), avatarUrl?, links (`{ label, url, icon? }[]`), interests (text), yearsInIt, yearsOfAngular (headline figures, entered by hand)                                            |
| **Experience**               | company, role, location?, startDate, endDate? (empty means current job), description, sortOrder, skills (many-to-many → Skill)                                                                                                                                                                                                       |
| **Highlight** (log line)     | experienceId? / projectId?, date, level (`achievement` \| `info` \| `learning` \| `milestone`), message, labels (JSON `Record<string,string>`), skills (many-to-many → Skill), impact? (`{ metric, before?, after?, changePct?, unit?, direction: 'up-is-good' \| 'down-is-good' }`, which feeds the impact panels), featured (bool) |
| **Education**                | school, degree, field?, startDate, endDate?, description?, sortOrder                                                                                                                                                                                                                                                                 |
| **Skill**                    | name, slug, category (e.g. "Languages", "Frameworks", "Cloud", "Observability"), level (1–5), color?, sortOrder                                                                                                                                                                                                                      |
| **Project**                  | slug, title, description, url?, repoUrl?, imageUrl?, startDate, endDate?, sortOrder, skills (many-to-many → Skill)                                                                                                                                                                                                                   |
| **ProjectSpan** (trace span) | projectId, parentSpanId?, name, startDate, endDate, note?, skills (many-to-many → Skill)                                                                                                                                                                                                                                             |
| **StatusAlert**              | name, state (`firing` \| `ok` \| `pending`), summary, sortOrder                                                                                                                                                                                                                                                                      |
| **ResumeFile**               | filename, mimeType, size, storagePath, uploadedAt (the newest one is the active PDF)                                                                                                                                                                                                                                                 |
| **AdminUser**                | email (unique), passwordHash                                                                                                                                                                                                                                                                                                         |

**Calculated values (not stored):**

- Skill usage over time comes from the dates of the experiences, projects and highlights linked to each skill.
- Years of experience and the stat values are calculated too.
- The backend calculates these in a `dashboard` module, so the frontend only draws them.

## API (high level; the `api-contract` agent writes the details in `docs/api-contract.md`)

- `GET /resume`: all public content in one call (profile, experiences, education, skills, projects, alerts).
- `GET /dashboard/stats?from&to&tech&category`: stat panel values.
- `GET /dashboard/skills-timeline?from&to&category`: time series data.
- `GET /logs?query=<logql-lite>&from&to`: highlight search. The query is parsed on the server, the same way real log tools do it.
- `GET /traces` and `GET /traces/:slug`: projects as traces (the trace search, and one project's spans).
- `GET /service-map`: nodes and edges.
- `GET /site-metrics?from&to`: aggregated live metrics of the site.
- `GET /resume-file`: download the active PDF.
- Admin create/update/delete for every entity, plus `POST /resume-file` (PDF upload), all protected by JWT.

### Real-time (WebSocket)

Socket.IO namespace `/live`, reached by the browser at path `/api/socket.io`. Clients subscribe to a "channel" (a group of messages) by sending an event.

| Client → server                            | Server → client                                      | Content                                                                         |
| ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `subscribe:metrics` `{ panels: string[] }` | `metrics:tick` (every 1 s)                           | `{ ts, rps, p50, p95, errorRate, activeVisitors }`                              |
| `subscribe:logs` `{ query?: string }`      | `logs:line` (sent in batches, at most 10 per second) | `{ ts, level, method, route, status, durationMs, country? }[]`                  |
| `subscribe:events`                         | `events:new`                                         | `{ ts, type, message }` (page viewed, PDF downloaded, ...)                      |
| —                                          | `content:changed`                                    | `{ entity, id }`: sent when the admin edits content, so open dashboards refresh |
| —                                          | `alert:state`                                        | `{ name, state }`: sent when a status alert changes                             |
| `unsubscribe:<channel>`                    | —                                                    | stop receiving that channel                                                     |

The server checks every message the client sends, limits each connection to 20 messages per second, and caps connections at 200 per IP.

## Auth

- **A single admin account**, kept in sync with `ADMIN_EMAIL` / `ADMIN_PASSWORD` on every startup. The backend creates the account, or updates its email or password if they changed. Changing `ADMIN_PASSWORD` and restarting is how the password is reset. Passwords are **salted and peppered**: `HMAC-SHA256(PASSWORD_PEPPER, password)`, then bcrypt (random salt, cost 12). The pepper is a server secret kept outside the database. This also means bcrypt's 72-byte limit doesn't cut long passwords short.
- `POST /api/auth/login` returns a JWT (HS256, signed with `JWT_SECRET`, 24 h). It's limited to 5 attempts per minute per IP, and answers the same way for an unknown email and a wrong password.
- **Secure by default:** every API route needs the token unless it's marked public (public routes are `GET` only, plus login).
- Frontend:
  - The token is kept in memory and `localStorage`, and the session ends automatically when the token expires.
  - An HTTP interceptor adds `Authorization: Bearer <token>` to `/api` calls only. If the API answers 401, the frontend signs out and opens the login page, returning to the original page after signing in. Only same-site return paths are allowed.
  - The sidebar shows "Sign in", or "Admin" and "Sign out" when signed in.
- No sign-up and no password reset by email.

## Technical choices

- **Monorepo:** Nx 23.3 (integrated). Projects:
  - `apps/frontend`: Angular 22, zoneless
  - `apps/backend`: NestJS 11
  - `apps/frontend-e2e`: Cypress
  - shared libraries in `libs/`: `@my-resume/api-models`, `resume-metrics` and `query-parser` now; `ui-panels` planned
- **Tests:** Vitest for all unit tests (frontend, backend, libraries), Cypress for end-to-end tests, test-driven development as the rule.
- **Charts:** Apache ECharts 6, for the time series, heatmap, state timeline, service map and live charts.
  - It's used through our own small Angular wrapper component in `libs/frontend/ui-panels`: signal inputs, resizing, a theme built from the CSS color tokens, cleanup on destroy. We don't use `ngx-echarts`.
  - Only the chart types in use are imported, and they load only on the pages that need them.
  - Stat, impact, bar-gauge, logs and trace-waterfall panels are plain HTML/CSS/SVG: lighter, more accessible, easier to style.
- **Dashboard grid:** CSS grid, with the layout set in code. Drag-and-drop editing of panels is out of scope.
- **Site metrics:**
  - `@opentelemetry/sdk-node` plus `prom-client` in NestJS, with a `/metrics` endpoint that is only reachable inside the Docker network.
  - A lightweight aggregation table (or the Prometheus HTTP API) feeds `/site-metrics`.
  - Optional later: real Prometheus and Tempo containers in `docker-compose.yml`.
- **Real-time:**
  - `@nestjs/websockets` and `@nestjs/platform-socket.io` on the backend, `socket.io-client` in Angular.
  - Socket.IO is chosen for automatic reconnection, rooms (one per channel) and its HTTP long-polling fallback.
  - A request-logging interceptor in NestJS publishes anonymized request events to an in-memory event bus (RxJS `Subject`). The gateway combines them into one data point per second and sends them only to the subscribed channels (rooms).
  - If several backend instances are run one day, the Socket.IO Redis adapter can share events between them.
  - In Angular, a `LiveService` wraps the socket in RxJS Observables (or signals) and takes care of subscribing, retrying and pausing when the tab is hidden.
- **PDF storage:** a Docker volume mounted into the backend container. Limit: 5 MB, `application/pdf` only.

## Build order

1. **Foundation:**
   - Backend: TypeORM, config, migrations, ValidationPipe, `/health`.
   - Frontend: dev proxy, app layout (sidebar and top bar), dark and light theme, routing.
2. **Auth:** admin seeding, login, JWT guard; login page, interceptor, admin guard.
3. **Content:** ✅ create/read/update/delete plus admin screens for Profile, Skills, Experience (**including its achievements**, moved here from step 5), Education and Projects; the public `GET /api/resume` bundle; the plain view `/resume` (printable). The initial content is seeded from the resume PDF (no phone number, no skill levels). This is the first usable version.
4. **Home dashboard:** ✅
   - `GET /api/dashboard` (one call for every panel), calculated in `libs/shared/resume-metrics`
   - the panels: profile, stats, career timeline (HTML), skills over time (line chart), experience by skill (bar gauge), impact cards, technologies per year (heatmap), latest highlights
   - Each panel has View, Inspect data and a table alternative for charts.
   - The time range and filters are kept in the URL.
   - Not done yet: the "Export PDF" button (step 9), the refresh and Live controls (step 8).
   - The "skill levels" bar gauge shows **years of experience per skill**, because the resume gives no levels; a level shows when set in the admin.
5. **Explore:** ✅
   - highlight labels and skills (admin form; existing highlights tagged with the skills their message names, by a migration)
   - the query parser, matcher and autocomplete in `libs/shared/query-parser` (written test-first)
   - `GET /api/logs` and `GET /api/logs/labels`; the log lines are built in `libs/shared/resume-metrics`
   - the `/explore` page: query bar with autocomplete and example queries, log volume chart (with a table view), expandable lines that narrow the query; the year range is in the URL
   - Not done yet: the live tail tab (step 8).
6. **Traces and service map:** ✅
   - project spans, edited as an outline in the project admin (indent/outdent, move with sub-spans); the spans of this site seeded from its git history
   - `GET /api/traces`, `GET /api/traces/:slug` and `GET /api/service-map`, calculated in `libs/shared/resume-metrics`
   - `/traces` (trace search table), `/traces/:slug` (HTML/CSS waterfall with expandable spans and a table view), `/service-map` (ECharts force graph with a table view; a node opens the filtered dashboard, the trace or the job's logs)
7. **Alerts:** StatusAlert entity and admin screen, alerting page.
8. **Live site metrics and streaming:**
   - Request instrumentation and `/site-metrics`.
   - The WebSocket gateway (`/live` namespace) and the Angular `LiveService`.
   - The meta dashboard in `Live` mode, the Explore live tail, and the "Visitors right now" stat.
   - `content:changed` and `alert:state` push messages.
9. **PDF:** upload and download, the "Export PDF" button, then optionally pre-filling content from the PDF.
10. **Quality dashboard and "How this site was built":** the build pipeline writes a quality report (tests, coverage, bundle size, Lighthouse); add the endpoint, the dashboard and the about page.
11. **Polish:** guided tour, SEO/OpenGraph tags (a preview image showing the dashboard), accessibility checks, performance budgets.
12. **Later: "Ask my resume" AI assistant.**
    - A chat assistant styled like a monitoring tool's query assistant. It answers questions about the resume using RAG over the stored content.
    - It can also turn a question into an Explore query or dashboard filters, e.g. "Angular projects in Australia" → `{location=~"Sydney.*"} |= "Angular"`.
    - Built with LangChain.js / LangGraph in NestJS and the Claude API.
    - Needs: an API key in the environment, a monthly spending cap, per-IP rate limits, answers based only on the resume (no made-up facts), and no storage of visitors' questions beyond aggregated counts.

## Out of scope (for now)

Multiple users, user-editable dashboard layouts, translations into other languages, storing data about individual visitors. The "Ask my resume" assistant is planned for later (step 12), not for the first release.

## Alternative themes considered

These could be added later as extra "skins" over the same data:

- **Terminal / CLI:** commands like `whoami`, `cat experience.log`, `kubectl describe pierre`.
- **IDE:** the resume as a code project (`experience.ts`, `skills.json`), with tabs and a file tree.
- **Git history:** career steps as commits, branches for side projects, tags for promotions.
- **CI/CD pipeline:** career stages as pipeline jobs with logs and artifacts.

## Open questions

- Should the theme switch default to dark or light?
- The site's name and branding (working title "Pierre O11y")?
- Should real Prometheus and Tempo containers be run, or should metrics be aggregated inside the backend (simpler and cheaper to host)?
- Should the site support translations (for example French and English)?
