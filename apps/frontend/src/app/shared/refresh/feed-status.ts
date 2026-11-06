/**
 * Where a dashboard's data comes from right now, for the LIVE badge:
 * - `connecting`, `live`, `reconnecting`: live mode over the socket
 * - `offline`: live mode, socket down, so polling every 5 s instead
 * - `fallback`: live mode, but the server refused the subscription, so polling every 5 s instead
 * - `poll-5s`, `poll-30s`, `poll-1m`: the chosen polling mode
 * - `paused`: the tab is hidden, nothing is fetched
 * - `off`: refresh is off
 */
export type FeedStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline'
  | 'fallback'
  | 'poll-5s'
  | 'poll-30s'
  | 'poll-1m'
  | 'paused'
  | 'off';
