# 0012. Sample the backend process in memory and stream it over Socket.IO

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** spec "Live site metrics" and "Real-time", commit 31267fd

## Context

The site monitors itself for real. It has too few visitors for traffic metrics to show anything but zero, and runs on a single small instance where extra containers cost money.

## Decision

- Show the health of the backend's own Node.js process, sampled every second with `perf_hooks` and `process` (event-loop delay, memory, CPU, GC), kept in an in-memory ring buffer of 300 samples, never stored. `GET /api/site-metrics/process?since` serves the history.
- Live updates over Socket.IO (namespace `/live`, path `/api/socket.io`), one room per channel, every subscribe acknowledged, data built only while someone is subscribed. Limits: message validation, 20 messages/s per connection, 200 connections per IP, 4 kB messages, proxy secret on the handshake.
- In Angular, `LiveService` is the only owner of the socket: reference-counted, imported dynamically, re-subscribes on reconnect, pauses when the tab is hidden. Pages fill gaps from the history and fall back to HTTP polling.

## Alternatives considered

- **Prometheus + Grafana/Tempo containers:** real, but heavier and paid to host; left as an open question.
- **`prom-client` / OpenTelemetry now:** still the plan for the deferred request metrics; not needed for process health.
- **Plain WebSocket or Server-Sent Events:** Socket.IO gives reconnection, rooms and a long-polling fallback.

## Consequences

No extra dependency or storage; history is lost on restart, which is acceptable. Several backend instances would need the Socket.IO Redis adapter. Every page still works without the socket.
