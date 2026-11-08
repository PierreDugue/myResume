import { parseSince, SINCE_MESSAGE } from '../site-metrics/since';

export type ParsedSubscribeMetrics = { sinceMs?: number } | { error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Validates the `subscribe:metrics` payload (`SubscribeMetricsRequest`): a plain object whose only
 * key is an optional `since` following the HTTP rule. A pure parser rather than a ValidationPipe:
 * the error must go back in the ack (a thrown WsException becomes a separate `exception` event and
 * the ack would never be called). Error messages never echo what the client sent (values or key names).
 */
export function parseSubscribeMetrics(payload: unknown): ParsedSubscribeMetrics {
  if (!isPlainObject(payload)) return { error: 'The request must be an object' };
  const unknown = Object.keys(payload).filter((key) => key !== 'since');
  if (unknown.length > 0) {
    return { error: 'Only "since" is allowed' };
  }
  if (payload['since'] === undefined) return {};
  const sinceMs = parseSince(payload['since']);
  if (sinceMs === null) {
    return { error: SINCE_MESSAGE };
  }
  return { sinceMs };
}
