# API contract

This file is the single source of truth for the HTTP and WebSocket API between `apps/frontend` and `apps/backend`.

- Owned by the `api-contract` agent.
- Its types are mirrored in `libs/shared/api-models` (`@my-resume/api-models`). Backend DTOs `implements` them and frontend services return them.

## Conventions

- **Base URL:** every route is under `/api`, the backend's global prefix. The paths below include it. The frontend calls them as relative URLs; nginx and the dev proxy forward them unchanged.
- **Format:** JSON, with camelCase field names.
  - Ids are uuid strings.
  - Dates are `YYYY-MM-DD` strings.
  - Timestamps are ISO 8601 strings.
- **Auth:** every endpoint needs `Authorization: Bearer <jwt>` unless it's marked public (–) in the tables. A missing, invalid or expired token returns `401`. Public endpoints are `GET` only, plus `POST /api/auth/login`.
- **Rate limits:** too many requests return `429`. Login allows 5 attempts per minute per IP.
- **Proxy secret (some deployments only):** when the backend is configured with `PROXY_SECRET`, requests that don't come through nginx (no valid `X-Proxy-Secret` header) return `403`, except `GET /api/health`. Browsers never see this, since they always go through nginx.
- **Errors:** Nest's default shape, `{ "statusCode": number, "message": string | string[], "error": string }`. Validation errors return `400` with `message` as an array.
- **Lists:** plain arrays sorted by `sortOrder` ascending (no pagination; the data sets are small).
- **Create vs update:** `POST` creates and returns `201` with the created object. `PATCH /:id` updates only the fields sent (partial update) and returns the updated object. `DELETE /:id` returns `204`.
- **Reorder:** `PUT /<resource>/order` with body `{ "ids": string[] }` sets the order and returns `204`.

## Endpoints

Each endpoint moves from **planned** to **done** once the backend and frontend both implement it.

### Foundation

| Method | Path          | Auth | Request | Response                                     | Status |
| ------ | ------------- | ---- | ------- | -------------------------------------------- | ------ |
| GET    | `/api/health` | –    | –       | `HealthResponse`, `200` (up) or `503` (down) | done   |

`GET /api/health` reports whether the API and its dependencies work. It checks:

- `database`: a ping to PostgreSQL, timing out after 5 s. A hosted database that sleeps when idle (Neon's free plan) can take a few seconds to wake up, which is slow but not down.

If any check fails, it returns `503` with `status: "error"`, and the failing check appears under `error` and `details`. The frontend shows this as the "API" status in the sidebar, and Docker uses it as the backend's health check.

```ts
type HealthStatus = 'ok' | 'error' | 'shutting_down';

interface HealthCheckResult {
  status: 'up' | 'down';
  responseTime?: number; // ms, when measured
  message?: string;
}

interface HealthResponse {
  status: HealthStatus;
  info?: Record<string, HealthCheckResult>; // checks that are up
  error?: Record<string, HealthCheckResult>; // checks that are down
  details: Record<string, HealthCheckResult>; // all checks
}
```

Example: `{ "status": "ok", "info": { "database": { "responseTime": 2, "status": "up" } }, "error": {}, "details": { "database": { "responseTime": 2, "status": "up" } } }`

### Auth

| Method | Path              | Auth | Request        | Response                                      | Status |
| ------ | ----------------- | ---- | -------------- | --------------------------------------------- | ------ |
| POST   | `/api/auth/login` | –    | `LoginRequest` | `LoginResponse` `200`, or `400`, `401`, `429` | done   |
| GET    | `/api/auth/me`    | ✔    | –              | `AuthUser` `200`, or `401`                    | done   |

- **Single admin account.** There's no sign-up and no password reset. On startup, the backend makes sure the admin account matches `ADMIN_EMAIL` and `ADMIN_PASSWORD`: it creates the account, or updates its email or password if they changed.
- `POST /api/auth/login`:
  - `200` with a JWT valid for 24 h (`expiresIn: 86400`, signed HS256).
  - `400` if the body is invalid: a bad email format, an empty password, or unknown fields.
  - `401` with `message: "Invalid credentials"` for a wrong email **or** a wrong password. The answer is the same in both cases, and takes about the same time, so it doesn't reveal which emails exist.
  - `429` after 5 attempts per minute from the same IP.
  - Email is case-insensitive and trimmed.
- `GET /api/auth/me`: returns the signed-in admin, or `401` if the token is missing, invalid or expired, or if the account no longer exists. The frontend uses it to show who is signed in.
- Logout is client-side: the frontend forgets the token. Tokens are stateless and expire after 24 h.
- The JWT payload is `{ sub: <admin id>, email }`. The frontend may read `exp` from it to log out on expiry; everything else is opaque.

```ts
interface LoginRequest {
  email: string; // valid email, case-insensitive
  password: string; // 1..200 characters
}

interface LoginResponse {
  accessToken: string; // JWT, send as "Authorization: Bearer <accessToken>"
  expiresIn: number; // seconds (86400)
}

interface AuthUser {
  id: string;
  email: string;
}
```

### Content (resume data)

| Method                | Path                     | Auth | Request                                               | Response                        | Status |
| --------------------- | ------------------------ | ---- | ----------------------------------------------------- | ------------------------------- | ------ |
| GET                   | `/api/resume`            | –    | –                                                     | `ResumeResponse`                | done   |
| GET                   | `/api/profile`           | ✔    | –                                                     | `Profile`, or `404` if none     | done   |
| PUT                   | `/api/profile`           | ✔    | `UpdateProfileRequest`                                | `Profile`                       | done   |
| GET                   | `/api/skills`            | –    | –                                                     | `Skill[]`                       | done   |
| POST / PATCH / DELETE | `/api/skills[/:id]`      | ✔    | `CreateSkillRequest` / `UpdateSkillRequest`           | `Skill` (`201` / `200`) / `204` | done   |
| PUT                   | `/api/skills/order`      | ✔    | `ReorderRequest`                                      | `204`                           | done   |
| GET                   | `/api/experiences`       | –    | –                                                     | `Experience[]`                  | done   |
| POST / PATCH / DELETE | `/api/experiences[/:id]` | ✔    | `CreateExperienceRequest` / `UpdateExperienceRequest` | `Experience` / `204`            | done   |
| PUT                   | `/api/experiences/order` | ✔    | `ReorderRequest`                                      | `204`                           | done   |
| GET                   | `/api/education`         | –    | –                                                     | `Education[]`                   | done   |
| POST / PATCH / DELETE | `/api/education[/:id]`   | ✔    | `CreateEducationRequest` / `UpdateEducationRequest`   | `Education` / `204`             | done   |
| PUT                   | `/api/education/order`   | ✔    | `ReorderRequest`                                      | `204`                           | done   |
| GET                   | `/api/projects`          | –    | –                                                     | `Project[]`                     | done   |
| POST / PATCH / DELETE | `/api/projects[/:id]`    | ✔    | `CreateProjectRequest` / `UpdateProjectRequest`       | `Project` / `204`               | done   |
| PUT                   | `/api/projects/order`    | ✔    | `ReorderRequest`                                      | `204`                           | done   |

**Rules shared by every resource:**

- **Lists** are sorted by `sortOrder`, ascending. New items are added **at the end**. `PUT …/order` with `{ ids }` sets the order; `ids` must contain **every** existing id of that list exactly once, or the API returns `400`.
- **`PATCH /:id`** updates only the fields sent. Sending `null` clears an optional field; leaving a field out keeps it.
- **Errors:**
  - `400` for validation errors, or for unknown ids in `skillIds`
  - `401` when signed out
  - `404` when the id doesn't exist (`:id` must be a uuid, otherwise `400`)
  - `409` for a duplicate unique value (skill name or slug, project slug)
- **Dates** are `YYYY-MM-DD`, and `endDate` (if set) can't be before `startDate`. An empty `endDate` means "current".
- **Slugs** match `^[a-z0-9]+(-[a-z0-9]+)*$`. If left out on create, the slug is generated from the name or title.
- **URLs** must be `http(s)://…`.
- **Text limits:** names and titles up to 120 characters; summaries, descriptions and messages up to 2000.

**Per resource:**

- **`GET /api/resume`** is the public, read-only bundle used by the plain view and later the dashboards: the profile plus every list, already sorted. The profile's `phone` is `null` unless `showPhone` is `true`.
- **`GET /api/profile`** is the admin's view of the profile, with the phone. There's a single profile; `PUT` creates it if it doesn't exist yet, then replaces it entirely.
- **Experiences** include their **highlights** (achievements, the future log lines).
  - In `POST` and `PATCH`, `highlights` is the complete, ordered list: items with an `id` are updated, items without one are created, and existing highlights missing from the list are deleted. An `id` that belongs to another experience returns `400`.
  - Deleting an experience deletes its highlights.
- **Highlight labels and skills** (shown in Explore):
  - `labels`: at most 10. Keys match `^[a-z][a-z0-9_]{0,29}$`, values are 1..60 characters. The keys Explore already sets are reserved and return `400`: `type`, `level`, `company`, `role`, `location`, `school`, `degree`, `project`, `tech`.
  - `skillIds`: unknown ids return `400`, like the experience's own `skillIds`.
- **Projects** include their **spans** (the phases of the project's trace), as an outline: a flat list in display order where each span has a `depth`.
  - In `POST` and `PATCH`, `spans` is the complete outline, like an experience's highlights: items with an `id` are updated, items without one are created, and spans missing from the list are deleted. An `id` that belongs to another project returns `400`.
  - The parent of a span is the nearest span above it with `depth - 1`. The first span has depth 0, and a span can be at most one level deeper than the span above it, with a maximum depth of 3. Otherwise `400`.
  - Dates: `endDate` (if set) can't be before `startDate`, and a span must fit in its parent: it can't start before it, and can't end after it (an ongoing span needs an ongoing parent). Spans must also fit in the project's own dates when they are set. A `PATCH` that changes the project's dates checks the existing spans again. Otherwise `400`, naming the span.
  - Deleting a project deletes its spans.
- **Skills:** deleting a skill removes it from every experience, project, highlight and span (no error).

```ts
type IsoDate = string; // 'YYYY-MM-DD'

interface ProfileLink {
  label: string; // 1..40, e.g. "LinkedIn"
  url: string; // http(s)
}

interface Profile {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string | null;
  showPhone: boolean; // false by default: the phone is only in the PDF
  location: string | null;
  openToRelocation: boolean;
  avatarUrl: string | null;
  links: ProfileLink[]; // max 10
  interests: string | null;
  yearsInIt: number | null; // headline figures, entered by hand (0..80)
  yearsOfAngular: number | null;
}
type UpdateProfileRequest = Profile;
type PublicProfile = Omit<Profile, 'showPhone'>; // phone is null unless showPhone

type SkillLevel = 1 | 2 | 3 | 4 | 5;
interface Skill {
  id: string;
  name: string; // unique (case-insensitive)
  slug: string; // unique
  category: string; // e.g. "Core Frameworks", "Languages", "AI"
  level: SkillLevel | null;
  sortOrder: number;
}
interface CreateSkillRequest {
  name: string;
  slug?: string;
  category: string;
  level?: SkillLevel | null;
}
type UpdateSkillRequest = Partial<CreateSkillRequest>;

type HighlightLevel = 'achievement' | 'info' | 'learning' | 'milestone';
interface Impact {
  metric: string; // e.g. "Page load time"
  before: number | null;
  after: number | null;
  changePct: number | null; // e.g. -35
  unit: string | null; // e.g. "%", "s"
  direction: 'up-is-good' | 'down-is-good';
}
/** Free labels of a log line, e.g. { team: "checkout" }. */
type HighlightLabels = Record<string, string>;
interface Highlight {
  id: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact: Impact | null;
  labels: HighlightLabels; // {} when none
  skillIds: string[]; // the technologies of this achievement, in skills-list order
  sortOrder: number;
}
interface HighlightInput {
  id?: string; // existing highlight of this experience, to update it
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact?: Impact | null;
  labels?: HighlightLabels; // left out = {} (the list replaces the highlight entirely)
  skillIds?: string[]; // left out = []
}

interface Experience {
  id: string;
  company: string;
  role: string;
  location: string | null; // e.g. "Sydney, Australia / Full Remote"
  startDate: IsoDate;
  endDate: IsoDate | null; // null = current job
  summary: string | null;
  skillIds: string[];
  highlights: Highlight[]; // ordered
  sortOrder: number;
}
interface CreateExperienceRequest {
  company: string;
  role: string;
  location?: string | null;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  summary?: string | null;
  skillIds?: string[];
  highlights?: HighlightInput[];
}
type UpdateExperienceRequest = Partial<CreateExperienceRequest>;

interface Education {
  id: string;
  school: string;
  degree: string;
  field: string | null;
  location: string | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  description: string | null;
  sortOrder: number;
}
interface CreateEducationRequest {
  school: string;
  degree: string;
  field?: string | null;
  location?: string | null;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  description?: string | null;
}
type UpdateEducationRequest = Partial<CreateEducationRequest>;

interface Project {
  id: string;
  slug: string; // unique, used in URLs (/traces/:slug)
  title: string;
  description: string;
  url: string | null;
  repoUrl: string | null;
  imageUrl: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  skillIds: string[];
  spans: ProjectSpan[]; // the trace's phases, in outline order
  sortOrder: number;
}
/** A phase or component of a project: a span of its trace. */
interface ProjectSpan {
  id: string;
  parentId: string | null; // null = a direct child of the project (the root span)
  depth: number; // 0 for direct children, up to 3
  name: string; // 1..120
  startDate: IsoDate;
  endDate: IsoDate | null; // null = ongoing
  note: string | null; // up to 2000
  skillIds: string[]; // in skills-list order
  sortOrder: number; // position in the outline
}
interface ProjectSpanInput {
  id?: string; // existing span of this project, to update it
  depth: number; // 0..3; the parent is the nearest span above with depth - 1
  name: string;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  note?: string | null;
  skillIds?: string[];
}
interface CreateProjectRequest {
  slug?: string;
  title: string;
  description: string;
  url?: string | null;
  repoUrl?: string | null;
  imageUrl?: string | null;
  startDate?: IsoDate | null;
  endDate?: IsoDate | null;
  skillIds?: string[];
  spans?: ProjectSpanInput[]; // the complete outline (at most 100)
}
type UpdateProjectRequest = Partial<CreateProjectRequest>;

interface ReorderRequest {
  ids: string[];
}

interface ResumeResponse {
  profile: PublicProfile | null;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}
```

**Not yet (later steps):** status alerts (step 7), the resume PDF (step 9).

### Dashboard (Career Overview)

| Method | Path             | Auth | Request                                  | Response                      | Status |
| ------ | ---------------- | ---- | ---------------------------------------- | ----------------------------- | ------ |
| GET    | `/api/dashboard` | –    | query: `from`, `to`, `category`, `skill` | `DashboardResponse`, or `400` | done   |

Every panel of the home dashboard in one call. The backend calculates everything from the resume content; the frontend only draws it.

- **Query parameters** (all optional; the frontend keeps them in the page URL):
  - `from`, `to`: years. The default range runs from the first job's year to the current year. They must be integers between 1950 and 2100, with `from ≤ to`; otherwise `400`.
  - `category`: a skill category, e.g. `AI`.
  - `skill`: a skill slug, e.g. `angular`.
  - An unknown `category` or `skill` returns `400`.
- **Months of use:** a skill counts for every calendar month of every experience and project linked to it (start month to end month inclusive; the current month for a current job). Overlapping jobs count a month once.
- **The range and filters apply** to the calculated panels:
  - jobs, technologies and achievements counts
  - timeline items overlapping the range
  - skill usage, skill totals and impacts
  - the latest highlights

  `skill` keeps only the jobs and projects that use it. `category` keeps only the skills of that category.

- **Headline figures don't depend on the range:** years in IT and years of Angular come from the profile (entered by hand), and "uptime" counts from the first job.
- **No gap markers:** the timeline only lists items. Periods between jobs are simply empty, as the spec requires.

```ts
interface DashboardRange {
  from: number; // year
  to: number;
}

interface DashboardFilters {
  minYear: number; // earliest year with content (education included)
  maxYear: number; // current year
  categories: string[]; // in skills-list order
  skills: { slug: string; name: string; category: string }[];
}

interface StatValue {
  key: 'yearsInIt' | 'yearsOfAngular' | 'uptime' | 'jobs' | 'technologies' | 'achievements';
  label: string; // e.g. "Years in IT"
  value: number;
  display: string; // formatted, e.g. "14+", "since 2011"
  hint: string | null; // e.g. "15 years"
}

interface CareerStatus {
  state: 'employed' | 'open-to-work'; // employed = a job without end date
  company: string | null; // current employer
  openToRelocation: boolean;
}

interface ImpactItem {
  highlightId: string;
  company: string;
  date: IsoDate;
  message: string;
  impact: Impact;
}

interface TimelineItem {
  id: string;
  kind: 'job' | 'education';
  label: string; // company or school
  sublabel: string | null; // role or degree
  startDate: IsoDate;
  endDate: IsoDate | null; // null = ongoing
}

interface SkillUsageSeries {
  skillId: string;
  slug: string;
  name: string;
  category: string;
  monthsPerYear: number[]; // aligned with SkillUsage.years, 0..12
  cumulativeYears: number[]; // experience at the end of each year, all-time, 1 decimal
  totalYears: number; // within the range, 1 decimal
}

interface SkillUsage {
  years: number[]; // from..to
  series: SkillUsageSeries[]; // skills used in the range, most used first
}

interface SkillTotalsGroup {
  category: string;
  skills: {
    skillId: string;
    slug: string;
    name: string;
    years: number;
    level: SkillLevel | null;
  }[];
}

interface LogLine {
  id: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  company: string;
}

interface DashboardResponse {
  range: DashboardRange; // as applied (defaults filled in)
  applied: { category: string | null; skill: string | null };
  filters: DashboardFilters;
  profile: PublicProfile | null;
  status: CareerStatus;
  stats: StatValue[]; // in display order
  impacts: ImpactItem[]; // newest first
  timeline: TimelineItem[]; // jobs and education, by start date
  skillUsage: SkillUsage;
  skillTotals: SkillTotalsGroup[]; // categories in skills-list order, skills by years desc
  latestHighlights: LogLine[]; // 5 newest
}
```

### Explore (logs)

| Method | Path               | Auth | Request                      | Response                 | Status |
| ------ | ------------------ | ---- | ---------------------------- | ------------------------ | ------ |
| GET    | `/api/logs`        | –    | query: `query`, `from`, `to` | `LogsResponse`, or `400` | done   |
| GET    | `/api/logs/labels` | –    | –                            | `LogLabel[]`             | done   |

The resume as a log stream, searched with a small LogQL-style language. The parser is shared by the backend (which filters) and the frontend (which checks the query as you type and suggests labels and values): `@my-resume/query-parser`.

**Log lines.** Each line has a date, a level, a source, a message, labels and technologies:

| `type`       | One line per               | Date                                 | Level         | Source  | Message                                                    | Labels                                     | `tech`                 |
| ------------ | -------------------------- | ------------------------------------ | ------------- | ------- | ---------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `experience` | highlight of an experience | the highlight's date                 | its own level | company | the highlight's message                                    | `company`, `role`, `location`¹, own labels | the highlight's skills |
| `education`  | education entry            | `endDate`, or `startDate` if ongoing | `milestone`   | school  | `Graduated: <degree>[, <field>]` (`Started: …` if ongoing) | `school`, `degree`, `location`¹            | –                      |
| `project`    | project with a `startDate` | `startDate`                          | `milestone`   | title   | `<title>: <description>`                                   | `project` (its slug)                       | the project's skills   |

Every line also has the labels `type` and `level`. ¹ only when set.

**Query language** (all parts optional; an empty query matches every line):

```
{company="Whoz", level=~"achievement|milestone"} |= "angular" != "legacy"
```

- **Label selector** `{…}`: comma-separated matchers `label op "value"`.
  - `=` equals, `!=` differs, `=~` matches the regular expression (whole value), `!~` doesn't match it.
  - Values are compared **case-insensitively**.
  - `tech` holds several values (skill names): `{tech="Angular"}` keeps lines with Angular among their technologies, `{tech!="Angular"}` lines without it.
  - A label a line doesn't have counts as the empty string (`{location=""}` keeps lines without a location).
- **Line filters**, after the selector: `|= "text"` contains, `!= "text"` doesn't contain, `|~ "regex"` matches, `!~ "regex"` doesn't match. They search the printed line, `<source> <message>`, case-insensitively.
- **Strings** use double quotes (`\"` and `\\` are escapes; any other backslash is kept, so `"\d+"` works) or backticks (raw, no escapes).
- **Plain text**: a query that doesn't start with `{`, `|` or `!` is a text search, the same as `|= "<the text>"`.
- **Regular expressions** use [RE2 syntax](https://github.com/google/re2/wiki/Syntax): no back-references and no lookarounds. They are matched with RE2, in time linear in the text, so no pattern can slow the server down.
- **Limits:** at most 500 characters per query, and 100 per regular expression.
- **Label names** are only the labels of the table above and a highlight's own labels: any other name, `constructor` included, is a missing label.
- A query that breaks these rules returns `400` with one message giving the column, e.g. `Expected "=", "!=", "=~" or "!~" after "company" (column 10)`.

**Range.** `from` and `to` are years, with the same rules as the dashboard (1950..2100, `from ≤ to`, otherwise `400`). By default they cover every line: from the year of the oldest line to the current year.

**Labels.** `GET /api/logs/labels` lists every label name used by at least one line, sorted by name (`type` and `level` first), with its distinct values sorted alphabetically. The frontend uses it for autocomplete.

```ts
type LogType = 'experience' | 'education' | 'project';

interface LogsQuery {
  query?: string;
  from?: number; // year
  to?: number;
}

interface LogEntry {
  id: string; // the highlight, education or project id
  type: LogType;
  date: IsoDate;
  level: HighlightLevel;
  source: string; // company, school or project title
  message: string;
  labels: Record<string, string>; // type, level, then the labels of the table above
  tech: string[]; // skill names, in skills-list order
}

interface LogVolume {
  year: number;
  total: number;
  levels: Record<HighlightLevel, number>; // every level present, 0 when none
}

interface LogsResponse {
  query: string; // as received ('' when left out)
  range: DashboardRange; // as applied
  bounds: DashboardRange; // the default range (oldest line's year to the current year), for range pickers
  total: number; // matching lines in the range
  entries: LogEntry[]; // newest first
  volume: LogVolume[]; // one bucket per year of the range, oldest first
}

interface LogLabel {
  name: string;
  values: string[];
}
```

### Traces

| Method | Path                | Auth | Request | Response          | Status |
| ------ | ------------------- | ---- | ------- | ----------------- | ------ |
| GET    | `/api/traces`       | –    | –       | `TraceSummary[]`  | done   |
| GET    | `/api/traces/:slug` | –    | –       | `Trace`, or `404` | done   |

Each project shown as a trace: the **root span** is the project itself, its children are the project's spans.

- **Which projects are traces:** those with a `startDate` or at least one span. Others aren't listed, and `GET /api/traces/:slug` returns `404` for them (as for an unknown slug).
- **Root span:** it starts at the project's `startDate`, or its first span's start when the project has none. It ends at the project's `endDate`; for an ongoing project (no `endDate`), at the latest of today and its spans' ends.
- **Ongoing spans** (no `endDate`) end today (or at their start, if that is later).
- **Durations** count calendar days, both ends included (a span from 2026-10-22 to 2026-10-22 lasts 1 day).
- **Position:** `offset` and `width` place each span on the root's time axis, as fractions of the root's duration (0..1), so the frontend only draws.
- The list is in the projects' order; the spans of a trace are the root, then the outline order.

```ts
interface TraceSpanSkill {
  slug: string;
  name: string;
}

interface TraceSpan {
  id: string; // the project id for the root
  parentId: string | null; // null for the root; the root's id for depth-1 spans
  depth: number; // 0 = root, 1..4 = spans
  name: string;
  startDate: IsoDate;
  endDate: IsoDate; // as drawn: today for an ongoing span
  ongoing: boolean;
  durationDays: number;
  offset: number; // 0..1, where it starts on the root's axis
  width: number; // 0..1, its length on the root's axis
  note: string | null; // the project description for the root
  tech: TraceSpanSkill[]; // in skills-list order; the project's skills for the root
}

interface Trace {
  slug: string;
  title: string;
  description: string;
  url: string | null;
  repoUrl: string | null;
  spans: TraceSpan[]; // the root first
}

interface TraceSummary {
  slug: string;
  title: string;
  startDate: IsoDate;
  endDate: IsoDate; // as drawn: today for an ongoing project
  ongoing: boolean;
  durationDays: number;
  spanCount: number; // without the root
  tech: string[]; // skill names of the project and its spans, in skills-list order
}
```

### Service map

| Method | Path               | Auth | Request | Response             | Status |
| ------ | ------------------ | ---- | ------- | -------------------- | ------ |
| GET    | `/api/service-map` | –    | –       | `ServiceMapResponse` | done   |

A graph of the resume: technologies linked to the jobs and projects that used them.

- **Nodes:** every experience (`job`), every project with a `startDate` (`project`), and every skill linked to at least one of them (`skill`). Ids are prefixed by kind (`skill:<id>`, `job:<id>`, `project:<id>`), so they never collide.
- **Edges** go from a job or a project to each of its skills. A project's skills include its spans' skills. No duplicate edges.
- **Size:** `years` is the experience behind a node, with one decimal: for a skill, the years of use counted as on the dashboard (every month of the jobs and projects that used it, overlaps counted once); for a job or a project, its own duration (an ongoing one runs until today).
- Nodes are ordered jobs (in experiences order), then projects (in projects order), then skills (in skills-list order).

```ts
type ServiceMapNodeKind = 'job' | 'project' | 'skill';

interface ServiceMapNode {
  id: string; // e.g. "skill:<uuid>"
  kind: ServiceMapNodeKind;
  label: string; // company, project title or skill name
  years: number;
  slug: string | null; // skill or project slug (links to the dashboard filter or the trace)
  category: string | null; // the skill's category
}

interface ServiceMapEdge {
  source: string; // a job or project node id
  target: string; // a skill node id
}

interface ServiceMapResponse {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}
```

## Types

Shared types are defined in each section above.
