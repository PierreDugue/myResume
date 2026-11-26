# 0006. ECharts through our own wrapper; simple panels in plain HTML/CSS/SVG

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** spec "Technical choices, Charts", `.claude/rules/frontend.md`

## Context

The dashboards need time series, a heatmap, a force graph and live charts, with dark and light themes, a table alternative for every chart, and a home dashboard under 2 seconds.

## Decision

- Apache ECharts 6 for real charts, used through our own small `EChart` component (signal inputs, resizing, theme from the CSS tokens, cleanup). Chart types are registered in `echarts-setup.ts` only, loaded on demand. Chart options are pure, unit-tested functions.
- Stat, impact, bar gauge, timeline, log and trace waterfall panels are plain HTML/CSS/SVG.
- Every chart has a table view in `Panel`.

## Alternatives considered

- **ngx-echarts:** imports more than needed, lags Angular releases, and the wrapper we need is small.
- **Chart.js / D3:** Chart.js lacks the force graph and heatmap we need; D3 means writing every chart by hand.
- **Charts for every panel:** heavier and less accessible than HTML for stats and logs.

## Consequences

Charts stay out of the initial bundle. In tests, `ECHARTS_LOADER` is faked (jsdom has no canvas).
