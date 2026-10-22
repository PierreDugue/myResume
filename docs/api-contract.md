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
- **Auth:** write endpoints need `Authorization: Bearer <jwt>`. A missing or invalid token returns `401`.
- **Errors:** Nest's default shape, `{ "statusCode": number, "message": string | string[], "error": string }`. Validation errors return `400` with `message` as an array.
- **Lists:** plain arrays sorted by `sortOrder` ascending (no pagination; the data sets are small).
- **Create vs update:** `POST` creates and returns `201` with the created object. `PATCH /:id` updates only the fields sent (partial update) and returns the updated object. `DELETE /:id` returns `204`.
- **Reorder:** `PUT /<resource>/order` with body `{ "ids": string[] }` sets the order and returns `204`.

## Endpoints

> ⚠️ This table is from before the observability redesign of `docs/spec.md` and must be redone (see the spec's "API" section). The `api-contract` agent rewrites it feature by feature, following the build order.

Status: **planned**. Each endpoint moves to **done** once the backend and frontend both implement it.

| Method                | Path                                 | Auth | Request                             | Response           | Status  |
| --------------------- | ------------------------------------ | ---- | ----------------------------------- | ------------------ | ------- |
| GET                   | `/health`                            | –    | –                                   | `{ status: "ok" }` | planned |
| POST                  | `/auth/login`                        | –    | `LoginRequest`                      | `LoginResponse`    | planned |
| GET                   | `/profile`                           | –    | –                                   | `Profile`          | planned |
| PUT                   | `/profile`                           | ✔    | `UpdateProfileRequest`              | `Profile`          | planned |
| GET                   | `/experiences`                       | –    | –                                   | `Experience[]`     | planned |
| POST / PATCH / DELETE | `/experiences[/:id]`                 | ✔    | `CreateExperienceRequest` / partial | `Experience`       | planned |
| PUT                   | `/experiences/order`                 | ✔    | `ReorderRequest`                    | –                  | planned |
| …                     | `/projects`, `/skills`, `/education` |      | same pattern as experiences         |                    | planned |

## Types

Each type is defined here when its feature is designed; see [spec.md](spec.md) for the fields.

```ts
interface LoginRequest {
  email: string;
  password: string;
}
interface LoginResponse {
  accessToken: string;
  expiresIn: number;
} // seconds
interface ReorderRequest {
  ids: string[];
}
```
