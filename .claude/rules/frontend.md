---
paths:
  - 'apps/frontend/**'
  - 'apps/frontend-e2e/**'
  - 'libs/frontend/**'
---

# Frontend conventions (`apps/frontend`)

Load the `angular-22` skill ([.claude/skills/angular-22/SKILL.md](../skills/angular-22/SKILL.md)) before writing Angular code: `@Service()`, no `changeDetection`, zoneless signals, signal forms, zoneless tests. Lint enforces the first two ([eslint.angular.mjs](../../eslint.angular.mjs)); new Angular libraries must add `angular22Rules` to their ESLint config. This file holds what's specific to this codebase.

## Structure

- Folder layout under `src/app/`:
  - `core/`: API services, auth, interceptors, guards, live/WebSocket service, theme, page title
  - `layout/`: the app shell (sidebar, top bar). `nav-items.ts` is the main navigation; add each new page there.
  - `public/`: dashboards and plain view
  - `admin/`: lazy-loaded, protected by `authGuard`
  - `shared/`: app-only UI. Reusable UI goes to a library in `libs/frontend/` once a second app needs it.
- Pages are lazy-loaded child routes of the `Shell` route in `app.routes.ts`, with a `title`. The title feeds the document title and the breadcrumb `h1`, so pages don't add their own `h1`.
- Use `HttpClient` only through typed services in `core/` that return `@my-resume/api-models` types. Components never call `HttpClient` directly.

## Auth ([core/auth/](../../apps/frontend/src/app/core/auth/))

- `AuthService` holds the session (`isAuthenticated`, `token`, `email` signals, plus `login()`, `logout()`, `me()`). When the token expires on an admin page, it goes to the login page.
- `authInterceptor` adds the token to `/api` calls; any 401 from our API (except login) signs out and opens the login page.
- The `admin` route uses `authGuard` as `canActivateChild`, so the session is checked on every admin page. The login page uses `guestGuard`.
- In tests, `fakeJwt()` from `core/auth/test-tokens.ts` makes tokens, and `$()` from `src/app/testing.ts` finds elements without `!`.

## Admin pages ([admin/](../../apps/frontend/src/app/admin/))

- Lists use the generic `AdminListPage`, configured through route `data: { list }` (`list/list-configs.ts`), with `OrderedList` for reordering and deleting.
- Edit pages use `editPage()` (`:id` or `new`, load from the list, then `page.save()` as the form's submit action, which goes back to the list) and `shared/form-utils.ts`: rules `httpUrl(path)`, `endOnOrAfterStart(start, end)`, `showError(field())`, and `textOrNull`/`numberOrNull` for the `toRequest(model)` mappers.
- Each page keeps its form model in a `signal()`, with pure `toModel(entity)` / `toRequest(model)` functions next to the component.
- Skills are picked with `SkillPicker` (`[(selected)]`). Content API calls go through `core/content/ContentApi`; show errors with `apiErrorMessage()`.
- Format dates with `shared/format/period.ts` (`formatPeriod`): it reads the strings directly, never through `Date`, so time zones can't shift them.
- Page tests use `admin/testing/render.ts` (`renderRoute`, `field(el, 'Label')`, `type()`, and `settle()` after a click so async submit actions finish) and `admin/testing/fixtures.ts`.

## Dashboards and styling

- Use the CSS tokens in `src/styles.scss` (`--color-*`, `--series-*`, `--space-*`), never hard-coded colors. Dark is the default; `[data-theme='light']` switches them. Shared classes: `.panel`, `.empty-state`, `.button`, `.icon-button`.
- Keep component styles under the budget (4kB warning per component). Load charts only when needed (`@defer` / lazy routes).
- Building blocks ([shared/panels/](../../apps/frontend/src/app/shared/panels/)):
  - `Panel`: frame with title, info tooltip, and a menu with View (full screen), Inspect data (JSON dialog) and an optional table view via `[(showTable)]`. **Every chart needs a table alternative.**
  - `EChart`: the ECharts wrapper, loading the `echarts-setup.ts` chunk on demand. Register new chart types or components in `echarts-setup.ts` only. In tests, provide `ECHARTS_LOADER` with a fake (jsdom has no canvas).
  - `StatPanel`, `BarGauge`, and `readChartPalette()` (chart colors from the CSS tokens, re-read when the theme changes).
- Chart options are **pure functions** (e.g. `public/overview/charts/*-option.ts`) with unit tests.
- Timeline, stat, gauge, impact, log and trace waterfall panels are plain HTML/CSS/SVG.
- The dashboard view (time range and filters) lives in the URL query (`?from&to&category&skill`): read it with `parseDashboardQuery`, write it with `router.navigate(..., { queryParams: toQueryParams(q) })`.

## Security

- nginx sends a strict Content-Security-Policy: no inline scripts or event handlers (`onload=`, ...). That's why the theme bootstrap is [public/theme-init.js](../../apps/frontend/public/theme-init.js) and critical-CSS inlining is off in `project.json`.

## e2e (Cypress)

- Screenshots: Cypress's window is 1280 px wide, so use `cy.viewport(1280, …)` or smaller; a wider viewport gets cropped and looks like an overflow bug.
- `--spec` paths are relative to `apps/frontend-e2e` (e.g. `--spec src/e2e/auth.cy.ts`).
