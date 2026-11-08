import { Service, inject, signal } from '@angular/core';
import type {
  LiveAck,
  LiveErrorCode,
  LiveServerEvents,
  ProcessMetricsHistory,
  ProcessSample,
  SubscribeMetricsRequest,
} from '@my-resume/api-models';
import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  concat,
  defer,
  distinctUntilChanged,
  finalize,
  from,
  map,
  merge,
  of,
  share,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { LIVE_SOCKET_FACTORY, type LiveSocket } from './live-socket';

/**
 * `idle`: no socket (nobody needs it). `connecting`: until the first connect. `reconnecting`:
 * dropped, Socket.IO is retrying with its backoff. `offline`: 3 failed attempts in a row
 * (Socket.IO keeps retrying in the background, and the status goes back to `connected` if one works).
 */
export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** What happens to the connection, for the stream inspector. */
export type LiveLifecycleEvent =
  | { kind: 'connect' }
  | { kind: 'disconnect'; reason: string }
  | { kind: 'reconnect_attempt'; attempt: number }
  | { kind: 'connect_error'; message: string };

/** What the `metrics` channel emits: the message it sent, then the history, then a tick per second. */
export type MetricsStreamEvent =
  | { kind: 'sent'; event: 'subscribe:metrics'; payload: SubscribeMetricsRequest }
  | { kind: 'history'; history: ProcessMetricsHistory }
  | { kind: 'tick'; sample: ProcessSample };

/** The server refused a subscription (`{ ok: false }` ack), e.g. `page_disabled`. */
export class LiveSubscribeError extends Error {
  constructor(
    readonly code: LiveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LiveSubscribeError';
  }
}

/** The socket is closed this long after the last consumer left (and reused if one comes back). */
const CLOSE_DELAY_MS = 5_000;
/** How long the server has to answer a subscribe message. */
const ACK_TIMEOUT_MS = 5_000;
/** Failed attempts in a row before the status says `offline`. */
const OFFLINE_AFTER_FAILURES = 3;
/** Ticks kept for a consumer that joins late: the server's window (5 minutes of 1-second samples). */
const MAX_REPLAYED_TICKS = 300;

/** The part of a channel that differs from the others (see `LiveService.channel`). */
interface ChannelSpec<Request, History, Event extends keyof LiveServerEvents, Out> {
  /** Evaluated on every (re)subscribe, so a reconnect only asks for what is missing. */
  request: () => Request;
  /** Sends the subscribe message and resolves with its ack. */
  subscribe: (socket: LiveSocket, request: Request) => Promise<LiveAck<History>>;
  unsubscribe: (socket: LiveSocket) => void;
  /** The server event that carries the channel's pushes. */
  push: Event;
  /** How many pushes a late consumer gets after the history (the window it needs to catch up). */
  replayPushes: number;
  onSent: (request: Request) => Out;
  onHistory: (history: History) => Out;
  onPush: (payload: Parameters<LiveServerEvents[Event]>[0]) => Out;
}

/**
 * The only owner of the `/live` socket: its lifecycle and the channel subscriptions. It knows
 * nothing about charts or refresh modes.
 *
 * The socket is created when the first consumer subscribes (never at app start), shared by every
 * consumer, and closed 5 s after the last one leaves. Subscriptions don't survive a reconnect on
 * the server, so every channel subscribes again on each `connect`.
 */
@Service()
export class LiveService {
  private readonly createSocket = inject(LIVE_SOCKET_FACTORY);
  private readonly current = signal<LiveStatus>('idle');
  private readonly lifecycle = new Subject<LiveLifecycleEvent>();
  /** The channels that have consumers, by name (see `channel`). */
  private readonly channels = new Map<string, SharedChannel<unknown>>();

  readonly status = this.current.asReadonly();
  readonly lifecycle$: Observable<LiveLifecycleEvent> = this.lifecycle.asObservable();

  /** Reference-counted: connects with the first subscriber, closes 5 s after the last one. */
  private readonly socket$: Observable<LiveSocket> = defer(() => {
    this.current.set('connecting');
    // A promise: the factory imports socket.io-client dynamically.
    return from(this.createSocket()).pipe(
      tap({ error: () => this.current.set('offline') }),
      switchMap((socket) => this.open(socket)),
    );
  }).pipe(
    share({
      connector: () => new ReplaySubject<LiveSocket>(1),
      resetOnRefCountZero: () => timer(CLOSE_DELAY_MS),
    }),
  );

  /**
   * Process samples of the backend: the history after `since()` (the `ts` of the last sample the
   * caller has, `undefined` for everything), then one tick per second. `since` is read on every
   * (re)subscribe, so after a reconnect only the missing samples are asked for. Ticks can arrive
   * around the history: merge by `ts`. A refused subscription (e.g. `page_disabled`) errors with
   * a `LiveSubscribeError`.
   */
  metrics(since: () => string | undefined): Observable<MetricsStreamEvent> {
    return this.channel<
      SubscribeMetricsRequest,
      ProcessMetricsHistory,
      'metrics:tick',
      MetricsStreamEvent
    >('metrics', {
      request: (): SubscribeMetricsRequest => {
        const ts = since();
        return ts === undefined ? {} : { since: ts };
      },
      subscribe: (socket, request) =>
        socket.timeout(ACK_TIMEOUT_MS).emitWithAck('subscribe:metrics', request),
      unsubscribe: (socket) => socket.emit('unsubscribe:metrics', () => undefined),
      push: 'metrics:tick',
      replayPushes: MAX_REPLAYED_TICKS,
      onSent: (payload) => ({ kind: 'sent', event: 'subscribe:metrics', payload }),
      onHistory: (history) => ({ kind: 'history', history }),
      onPush: (sample) => ({ kind: 'tick', sample }),
    });
  }

  /**
   * A channel is a room on the namespace: a subscribe message acknowledged with the history, then
   * pushes. The server room is per socket, so the channel is shared per socket: however many
   * consumers there are, it sends one subscribe message (the first consumer's `request` is used,
   * and again after every reconnect) and one unsubscribe message, when the last consumer leaves
   * (and only if still connected).
   *
   * A consumer that joins later gets the current window from the channel itself, with no message
   * to the server: the latest history, then the pushes since (at most `replayPushes`). It is
   * delivered synchronously on subscribe, before anything new, and consumers merge by `ts`.
   */
  private channel<Request, History, Event extends keyof LiveServerEvents, Out>(
    name: string,
    spec: ChannelSpec<Request, History, Event, Out>,
  ): Observable<Out> {
    return defer(() => {
      let shared = this.channels.get(name) as SharedChannel<Out> | undefined;
      if (!shared) {
        shared = this.shareChannel(name, spec);
        this.channels.set(name, shared);
      }
      const { replay, live$ } = shared;
      return concat(from([...replay]), live$);
    });
  }

  private shareChannel<Request, History, Event extends keyof LiveServerEvents, Out>(
    name: string,
    spec: ChannelSpec<Request, History, Event, Out>,
  ): SharedChannel<Out> {
    const replay: Out[] = [];
    let history: Out[] = [];
    let pushes: Out[] = [];
    const remember = (out: Tagged<Out>): void => {
      if (out.kind === 'sent') return;
      if (out.kind === 'history') {
        history = [out.out];
        pushes = [];
      } else {
        pushes.push(out.out);
        if (pushes.length > spec.replayPushes) pushes.shift();
      }
      replay.splice(0, replay.length, ...history, ...pushes);
    };

    const live$ = this.socket$.pipe(
      switchMap((socket) => {
        const subscribed$ = connection$(socket).pipe(
          // Leaving while a subscribe is in flight (a drop) cancels it, so a late answer is ignored.
          switchMap((connected) => (connected ? subscribe(socket, spec) : EMPTY)),
        );
        const pushes$ = fromSocketEvent<Parameters<LiveServerEvents[Event]>[0]>(
          socket,
          spec.push,
        ).pipe(map((payload): Tagged<Out> => ({ kind: 'push', out: spec.onPush(payload) })));
        return merge(subscribed$, pushes$).pipe(
          finalize(() => {
            if (socket.connected) spec.unsubscribe(socket);
          }),
        );
      }),
      tap(remember),
      map((tagged) => tagged.out),
      finalize(() => {
        // The last consumer left, or the stream failed: the next one starts a new channel.
        if (this.channels.get(name)?.replay === replay) this.channels.delete(name);
      }),
      share({ resetOnRefCountZero: true }),
    );
    return { replay, live$ };
  }

  /** Wires the socket's lifecycle to the status and `lifecycle$`, connects it, and closes it on teardown. */
  private open(socket: LiveSocket): Observable<LiveSocket> {
    return new Observable<LiveSocket>((subscriber) => {
      let failures = 0;
      const onConnect = () => {
        failures = 0;
        this.current.set('connected');
        this.lifecycle.next({ kind: 'connect' });
      };
      const onDisconnect = (reason: string) => {
        failures = 0;
        this.current.set('reconnecting');
        this.lifecycle.next({ kind: 'disconnect', reason });
        // Socket.IO retries by itself, except after the server closed the connection.
        if (reason === 'io server disconnect') socket.connect();
      };
      const onConnectError = (error: Error) => {
        failures++;
        if (failures >= OFFLINE_AFTER_FAILURES) this.current.set('offline');
        this.lifecycle.next({ kind: 'connect_error', message: error.message });
      };
      const onAttempt = (attempt: number) =>
        this.lifecycle.next({ kind: 'reconnect_attempt', attempt });

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.io.on('reconnect_attempt', onAttempt);
      socket.connect();
      subscriber.next(socket);

      return () => {
        // Listeners first: closing our own socket is not a "disconnect" worth reporting.
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.io.off('reconnect_attempt', onAttempt);
        socket.disconnect();
        this.current.set('idle');
      };
    });
  }
}

/** What a channel emits, tagged so the replay for late consumers knows what to keep. */
interface Tagged<Out> {
  kind: 'sent' | 'history' | 'push';
  out: Out;
}

/** A channel with consumers: the shared stream, and what a consumer joining now has missed. */
interface SharedChannel<Out> {
  replay: Out[];
  live$: Observable<Out>;
}

/** Sends the subscribe message and emits what it sent, then the history of the ack. */
function subscribe<Request, History, Event extends keyof LiveServerEvents, Out>(
  socket: LiveSocket,
  spec: ChannelSpec<Request, History, Event, Out>,
): Observable<Tagged<Out>> {
  return defer(() => {
    const request = spec.request();
    // A promise: Socket.IO's acknowledgement API.
    const ack$ = defer(() => from(spec.subscribe(socket, request))).pipe(
      map((ack): Tagged<Out> => {
        if (!ack.ok) throw new LiveSubscribeError(ack.error, ack.message);
        return { kind: 'history', out: spec.onHistory(ack.data) };
      }),
    );
    return concat(of<Tagged<Out>>({ kind: 'sent', out: spec.onSent(request) }), ack$);
  });
}

/** Whether the socket is connected: now, and whenever that changes. */
function connection$(socket: LiveSocket): Observable<boolean> {
  return merge(
    fromSocketEvent(socket, 'connect').pipe(map(() => true)),
    fromSocketEvent(socket, 'disconnect').pipe(map(() => false)),
  ).pipe(startWith(socket.connected), distinctUntilChanged());
}

/** The same listener API for every event name, reserved (`connect`) or not (`metrics:tick`). */
interface SocketListeners {
  on(event: string, listener: (payload: never) => void): unknown;
  off(event: string, listener: (payload: never) => void): unknown;
}

function fromSocketEvent<T>(socket: LiveSocket, event: string): Observable<T> {
  const listeners = socket as unknown as SocketListeners;
  return new Observable<T>((subscriber) => {
    const listener = (payload: T) => subscriber.next(payload);
    listeners.on(event, listener as (payload: never) => void);
    return () => listeners.off(event, listener as (payload: never) => void);
  });
}
