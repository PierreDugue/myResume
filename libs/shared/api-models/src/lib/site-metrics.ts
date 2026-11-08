/** One sample of the backend's Node.js process, covering the last interval (1 s). Contains no personal or environment data. */
export interface ProcessSample {
  /** ISO timestamp (server clock), end of the interval; strictly increasing. */
  ts: string;
  /** Whole seconds since the process started. */
  uptimeSeconds: number;
  /** Event-loop delay over the interval, in ms, 2 decimals. */
  eventLoopLagMs: { p50: number; p99: number };
  /** 1 MB = 1,000,000 bytes, 1 decimal. */
  memoryMb: { rss: number; heapTotal: number; heapUsed: number };
  /** Process CPU (user + system) over the interval, % of one core, 1 decimal; can exceed 100. */
  cpuPercent: number;
  /** GC pauses observed during the interval; major = mark-sweep-compact, minor = everything else (scavenge, incremental marking, weak callbacks); ms with 2 decimals. */
  gc: { minorCount: number; minorMs: number; majorCount: number; majorMs: number };
}

/** `GET /api/site-metrics/process` response, and the ack of the socket's `subscribe:metrics`. */
export interface ProcessMetricsHistory {
  /** ISO: when the backend process started (changes after a deploy or restart). */
  startedAt: string;
  /** 1000. */
  intervalMs: number;
  /** Oldest first; at most 300 (the last 5 minutes). */
  samples: ProcessSample[];
}

/** Query of `GET /api/site-metrics/process`. */
export interface ProcessMetricsQuery {
  /** ISO 8601 timestamp, exclusive cursor: only samples with a strictly later `ts` are returned. At most 40 characters. Left out = the whole buffer. A value with a time part must include an offset (`Z` or `±hh:mm`), otherwise `400` (socket: `invalid_message`); a date-only value (`YYYY-MM-DD`) is read as midnight UTC. Clients send back the `ts` of a sample, which always ends in `Z`. */
  since?: string;
}
