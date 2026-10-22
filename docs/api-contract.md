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

### Later features

> ⚠️ The rows below are from before the observability redesign of `docs/spec.md` and must be redone (see the spec's "API" section). The `api-contract` agent rewrites them feature by feature, following the build order.

| Method                | Path                                 | Auth | Request                             | Response       | Status  |
| --------------------- | ------------------------------------ | ---- | ----------------------------------- | -------------- | ------- |
| GET                   | `/profile`                           | –    | –                                   | `Profile`      | planned |
| PUT                   | `/profile`                           | ✔    | `UpdateProfileRequest`              | `Profile`      | planned |
| GET                   | `/experiences`                       | –    | –                                   | `Experience[]` | planned |
| POST / PATCH / DELETE | `/experiences[/:id]`                 | ✔    | `CreateExperienceRequest` / partial | `Experience`   | planned |
| PUT                   | `/experiences/order`                 | ✔    | `ReorderRequest`                    | –              | planned |
| …                     | `/projects`, `/skills`, `/education` |      | same pattern as experiences         |                | planned |

## Types

Each type is defined here when its feature is designed; see [spec.md](spec.md) for the fields.

```ts
interface ReorderRequest {
  ids: string[];
}
```
