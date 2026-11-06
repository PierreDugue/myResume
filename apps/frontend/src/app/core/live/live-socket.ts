import { InjectionToken } from '@angular/core';
import type { LiveClientEvents, LiveServerEvents } from '@my-resume/api-models';
import type { Socket } from 'socket.io-client';

/** The `/live` socket, typed with the contract's event maps. */
export type LiveSocket = Socket<LiveServerEvents, LiveClientEvents>;

/**
 * Creates the `/live` socket, **not connected yet** (LiveService connects it once its listeners
 * are set). This is the seam tests replace with a fake: Socket.IO is an external system.
 *
 * socket.io-client is imported dynamically, so it stays out of every bundle until a page opens
 * the socket (see docs/spec.md, Real-time). Same origin: the dev proxy and nginx forward
 * `/api/socket.io`, WebSocket upgrades included. Reconnection backs off from 1 s up to 30 s.
 */
export const LIVE_SOCKET_FACTORY = new InjectionToken<() => Promise<LiveSocket>>(
  'LIVE_SOCKET_FACTORY',
  {
    providedIn: 'root',
    factory: () => () =>
      import('socket.io-client').then(({ io }) =>
        io('/live', {
          path: '/api/socket.io',
          autoConnect: false,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
        }),
      ),
  },
);
