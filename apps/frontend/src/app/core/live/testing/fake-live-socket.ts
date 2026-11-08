import type { LiveAck } from '@my-resume/api-models';
import { vi } from 'vitest';
import type { LiveSocket } from '../live-socket';

type Handler = (...args: unknown[]) => void;

/** A message sent with `emitWithAck`, waiting for the test to answer it. */
export interface PendingAck {
  event: string;
  payload: unknown;
  resolve: (response: LiveAck<unknown>) => void;
  reject: (error: Error) => void;
}

/**
 * A fake of the Socket.IO client socket (an external system), with the part of its API that
 * LiveService uses. The test plays the server: `serverConnect()`, `serverTick()`, `acks[n].resolve()`...
 */
export class FakeLiveSocket {
  connected = false;
  /** Every `emitWithAck` (subscribe messages), in order. */
  readonly acks: PendingAck[] = [];
  /** Every plain `emit` (unsubscribe messages), in order. */
  readonly emitted: { event: string; args: unknown[] }[] = [];
  readonly connect = vi.fn(() => undefined);
  readonly disconnect = vi.fn(() => {
    this.connected = false;
  });
  /** The Manager (`socket.io`): reconnection attempts are announced there. */
  readonly io = {
    on: (event: string, handler: Handler) => this.add(this.managerHandlers, event, handler),
    off: (event: string, handler: Handler) => this.managerHandlers.get(event)?.delete(handler),
  };

  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly managerHandlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): this {
    this.add(this.handlers, event, handler);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    this.emitted.push({ event, args });
    return this;
  }

  timeout(ms: number) {
    void ms;
    return {
      emitWithAck: (event: string, payload: unknown) =>
        new Promise<LiveAck<unknown>>((resolve, reject) => {
          this.acks.push({ event, payload, resolve, reject });
        }),
    };
  }

  /** How many handlers listen for `event` on the socket. */
  listeners(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  // --- the server's side ---

  serverConnect(): void {
    this.connected = true;
    this.fire(this.handlers, 'connect');
  }

  serverDisconnect(reason = 'transport close'): void {
    this.connected = false;
    this.fire(this.handlers, 'disconnect', reason);
  }

  connectError(message = 'xhr poll error'): void {
    this.fire(this.handlers, 'connect_error', new Error(message));
  }

  reconnectAttempt(attempt: number): void {
    this.fire(this.managerHandlers, 'reconnect_attempt', attempt);
  }

  push(event: string, payload: unknown): void {
    this.fire(this.handlers, event, payload);
  }

  private add(map: Map<string, Set<Handler>>, event: string, handler: Handler): void {
    const set = map.get(event) ?? new Set<Handler>();
    set.add(handler);
    map.set(event, set);
  }

  private fire(map: Map<string, Set<Handler>>, event: string, ...args: unknown[]): void {
    for (const handler of [...(map.get(event) ?? [])]) handler(...args);
  }

  /** The fake, typed as the real socket (the one cast of the tests). */
  asSocket(): LiveSocket {
    return this as unknown as LiveSocket;
  }
}
