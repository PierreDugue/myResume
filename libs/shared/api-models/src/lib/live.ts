import type { ProcessMetricsHistory, ProcessSample, ProcessMetricsQuery } from './site-metrics';

/** Payload of `subscribe:metrics`: same rules as the HTTP `since`. `{}` = everything; unknown keys are invalid. */
export type SubscribeMetricsRequest = ProcessMetricsQuery;

export type LiveErrorCode = 'invalid_message' | 'rate_limited' | 'page_disabled';

/** Acknowledgement of a client message. */
export type LiveAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: LiveErrorCode; message: string };

/** Events the server sends on the `/live` namespace. Server: `Namespace<LiveClientEvents, LiveServerEvents>`; client: `Socket<LiveServerEvents, LiveClientEvents>`. New channels add their events here. */
export interface LiveServerEvents {
  'metrics:tick': (sample: ProcessSample) => void;
}

/** Events the client sends on the `/live` namespace. New channels add their events here. */
export interface LiveClientEvents {
  'subscribe:metrics': (
    request: SubscribeMetricsRequest,
    ack: (response: LiveAck<ProcessMetricsHistory>) => void,
  ) => void;
  'unsubscribe:metrics': (ack: (response: LiveAck<null>) => void) => void;
}
