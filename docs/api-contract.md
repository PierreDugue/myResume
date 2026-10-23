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

- `database`: a ping to PostgreSQL, timing out after 1.5 s

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
- **Skills:** deleting a skill removes it from every experience and project (no error).

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
interface Highlight {
  id: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact: Impact | null;
  sortOrder: number;
}
interface HighlightInput {
  id?: string; // existing highlight of this experience, to update it
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact?: Impact | null;
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
  sortOrder: number;
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

**Not yet (later steps):** highlight labels and skills (step 5, Explore), project spans (step 6), status alerts (step 7), the resume PDF (step 9).

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

## Types

Shared types are defined in each section above.
