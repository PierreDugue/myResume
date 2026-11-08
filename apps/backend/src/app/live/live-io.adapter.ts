import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { IncomingMessage } from 'node:http';
import type { Server, ServerOptions } from 'socket.io';
import { ProxyTrust } from '../auth/proxy-trust';
import { ConnectionLimiter } from './connection-limiter';
import { handshakeClientIp } from './handshake-client-ip';

/** Under the /api prefix, so nginx and the dev proxy forward it like the rest of the API. */
export const LIVE_SOCKET_PATH = '/api/socket.io';
/** Larger client messages close the connection (docs/api-contract.md, Real-time). */
export const LIVE_MAX_MESSAGE_BYTES = 4096;
export const MAX_CONNECTIONS_PER_IP = 200;

export interface LiveIoAdapterOptions {
  maxConnectionsPerIp?: number;
}

/**
 * The Socket.IO server for every gateway: path, message size, no bundled client, and the
 * handshake checks: the proxy secret (ProxyTrust, as for HTTP) and at most 200 open connections
 * per visitor IP. Connections are counted by the engine, so every namespace counts. Same-origin
 * only (nginx or the dev proxy), so no CORS option. Wired by configureApp().
 */
export class LiveIoAdapter extends IoAdapter {
  private readonly connections: ConnectionLimiter;

  constructor(
    private readonly app: INestApplicationContext,
    options: LiveIoAdapterOptions = {},
  ) {
    super(app);
    this.connections = new ConnectionLimiter(options.maxConnectionsPerIp ?? MAX_CONNECTIONS_PER_IP);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // Resolved here, not in the constructor: apps without a gateway never need AuthModule's provider.
    const proxyTrust = this.app.get(ProxyTrust, { strict: false });
    const clientIps = new WeakMap<IncomingMessage, string>();

    const server: Server = super.createIOServer(port, {
      ...options,
      path: LIVE_SOCKET_PATH,
      serveClient: false,
      maxHttpBufferSize: LIVE_MAX_MESSAGE_BYTES,
      allowRequest: (
        req: IncomingMessage,
        callback: (error: string | null | undefined, success: boolean) => void,
      ) => {
        const { allowed, clientIp } = proxyTrust.check(req.headers);
        if (!allowed) return callback('Forbidden', false);
        const ip = handshakeClientIp(req, clientIp);
        if (!this.connections.canAcquire(ip)) return callback('Too many connections', false);
        clientIps.set(req, ip);
        callback(null, true);
      },
    });

    server.engine.on('connection', (rawSocket: EngineSocket) => {
      const ip = clientIps.get(rawSocket.request) ?? handshakeClientIp(rawSocket.request);
      clientIps.delete(rawSocket.request);
      // Two handshakes from one IP can both pass allowRequest before either connects.
      if (!this.connections.tryAcquire(ip)) {
        rawSocket.close();
        return;
      }
      rawSocket.once('close', () => this.connections.release(ip));
    });

    return server;
  }
}

/** The part of engine.io's Socket used here. */
interface EngineSocket {
  request: IncomingMessage;
  once(event: 'close', listener: () => void): void;
  close(): void;
}
