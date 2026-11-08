import { TestBed } from '@angular/core/testing';
import type { LiveAck, ProcessMetricsHistory } from '@my-resume/api-models';
import {
  historyOf,
  sampleAt,
  samplesBetween,
  tsAt,
} from '../../public/site-metrics/testing/process-fixture';
import { LIVE_SOCKET_FACTORY } from './live-socket';
import {
  LiveService,
  LiveSubscribeError,
  type LiveLifecycleEvent,
  type MetricsStreamEvent,
} from './live.service';
import { FakeLiveSocket } from './testing/fake-live-socket';

/** Lets promise callbacks (the socket factory, acks) run. Works with fake timers. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const ok = (data: ProcessMetricsHistory): LiveAck<ProcessMetricsHistory> => ({ ok: true, data });

describe('LiveService', () => {
  let sockets: FakeLiveSocket[];
  let factory: ReturnType<typeof vi.fn<() => Promise<ReturnType<FakeLiveSocket['asSocket']>>>>;
  let live: LiveService;

  beforeEach(() => {
    sockets = [];
    factory = vi.fn(() => {
      const socket = new FakeLiveSocket();
      sockets.push(socket);
      return Promise.resolve(socket.asSocket());
    });
    TestBed.configureTestingModule({
      providers: [{ provide: LIVE_SOCKET_FACTORY, useValue: factory }],
    });
    live = TestBed.inject(LiveService);
  });

  afterEach(() => vi.useRealTimers());

  /** Subscribes to the metrics channel, collecting what it emits. */
  function listen(since: () => string | undefined = () => undefined) {
    const events: MetricsStreamEvent[] = [];
    const errors: unknown[] = [];
    const subscription = live.metrics(since).subscribe({
      next: (e) => events.push(e),
      error: (e: unknown) => errors.push(e),
    });
    return { events, errors, stop: () => subscription.unsubscribe() };
  }

  /** Opens a connected socket with the subscribe message answered by `history`. */
  async function connected(history: ProcessMetricsHistory = historyOf([])) {
    const view = listen();
    await settle();
    const socket = sockets[0];
    socket.serverConnect();
    socket.acks[0].resolve(ok(history));
    await settle();
    return { ...view, socket };
  }

  describe('opening the socket', () => {
    it('does not connect until a page needs it', async () => {
      await settle();
      expect(factory).not.toHaveBeenCalled();
      expect(live.status()).toBe('idle');
    });

    it('creates one socket on the first consumer and connects it, "connecting" until it is up', async () => {
      listen();
      expect(live.status()).toBe('connecting');
      await settle();
      expect(factory).toHaveBeenCalledOnce();
      expect(sockets[0].connect).toHaveBeenCalledOnce();
      expect(live.status()).toBe('connecting');
    });

    it('is "connected" once the socket connects', async () => {
      listen();
      await settle();
      sockets[0].serverConnect();
      expect(live.status()).toBe('connected');
    });

    it('shares one socket between consumers', async () => {
      listen();
      listen();
      await settle();
      expect(factory).toHaveBeenCalledOnce();
    });

    it('fails the consumer, and goes offline, when the socket cannot even be created', async () => {
      factory.mockRejectedValueOnce(new Error('chunk failed to load'));
      const { errors } = listen();
      await settle();
      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('chunk failed to load');
      expect(live.status()).toBe('offline');
    });
  });

  describe('subscribing to the metrics', () => {
    it('sends nothing before the socket is connected', async () => {
      listen();
      await settle();
      expect(sockets[0].acks).toHaveLength(0);
    });

    it('sends subscribe:metrics on connect, with {} when the caller has no sample yet', async () => {
      listen(() => undefined);
      await settle();
      sockets[0].serverConnect();
      expect(sockets[0].acks).toHaveLength(1);
      expect(sockets[0].acks[0].event).toBe('subscribe:metrics');
      expect(sockets[0].acks[0].payload).toStrictEqual({});
    });

    it('sends since, the ts of the last sample the caller has', async () => {
      listen(() => tsAt(41));
      await settle();
      sockets[0].serverConnect();
      expect(sockets[0].acks[0].payload).toStrictEqual({ since: tsAt(41) });
    });

    it('subscribes at once when it finds the socket already connected', async () => {
      const first = await connected();
      first.stop(); // within the 5 s the socket stays open
      listen(() => tsAt(5));
      await settle();
      expect(first.socket.acks).toHaveLength(2);
      expect(first.socket.acks[1].payload).toStrictEqual({ since: tsAt(5) });
    });

    it('emits what it sent, then the history of the ack', async () => {
      const history = historyOf(samplesBetween(0, 2));
      const { events } = await connected(history);
      expect(events).toEqual([
        { kind: 'sent', event: 'subscribe:metrics', payload: {} },
        { kind: 'history', history },
      ]);
    });

    it('emits every tick, including one that arrives before the ack', async () => {
      const view = listen();
      await settle();
      const socket = sockets[0];
      socket.serverConnect();
      socket.push('metrics:tick', sampleAt(3));
      socket.acks[0].resolve(ok(historyOf(samplesBetween(0, 2))));
      await settle();
      socket.push('metrics:tick', sampleAt(4));
      expect(view.events.map((e) => e.kind)).toEqual(['sent', 'tick', 'history', 'tick']);
      expect(view.events[1]).toEqual({ kind: 'tick', sample: sampleAt(3) });
    });

    it('subscribes again on every reconnect, asking only for what it missed', async () => {
      let lastTs: string | undefined = tsAt(10);
      const view = listen(() => lastTs);
      await settle();
      const socket = sockets[0];
      socket.serverConnect();
      socket.acks[0].resolve(ok(historyOf([sampleAt(10)])));
      await settle();

      socket.serverDisconnect();
      lastTs = tsAt(25);
      socket.serverConnect();
      expect(socket.acks).toHaveLength(2);
      expect(socket.acks[1].payload).toStrictEqual({ since: tsAt(25) });
      socket.acks[1].resolve(ok(historyOf(samplesBetween(26, 27))));
      await settle();
      expect(view.events[view.events.length - 1]).toEqual({
        kind: 'history',
        history: historyOf(samplesBetween(26, 27)),
      });
    });

    it('ignores the answer of a subscribe that a disconnect left behind', async () => {
      const view = listen();
      await settle();
      const socket = sockets[0];
      socket.serverConnect();
      socket.serverDisconnect();
      socket.serverConnect();
      // The first message never reached the server; answering it late must not count.
      socket.acks[0].resolve(ok(historyOf([sampleAt(1)])));
      await settle();
      expect(view.events.filter((e) => e.kind === 'history')).toHaveLength(0);
      socket.acks[1].resolve(ok(historyOf([sampleAt(2)])));
      await settle();
      expect(view.events.filter((e) => e.kind === 'history')).toHaveLength(1);
    });

    it('errors with a typed error when the server refuses (a disabled page)', async () => {
      const view = listen();
      await settle();
      sockets[0].serverConnect();
      sockets[0].acks[0].resolve({ ok: false, error: 'page_disabled', message: 'Page disabled' });
      await settle();
      expect(view.errors).toHaveLength(1);
      const error = view.errors[0] as LiveSubscribeError;
      expect(error).toBeInstanceOf(LiveSubscribeError);
      expect(error.code).toBe('page_disabled');
      expect(error.message).toBe('Page disabled');
    });

    it('errors when the ack does not come (timeout)', async () => {
      const view = listen();
      await settle();
      sockets[0].serverConnect();
      sockets[0].acks[0].reject(new Error('operation has timed out'));
      await settle();
      expect(view.errors).toHaveLength(1);
      expect((view.errors[0] as Error).message).toBe('operation has timed out');
    });
  });

  describe('leaving', () => {
    it('removes its listeners and sends unsubscribe:metrics when still connected', async () => {
      const { stop, socket, events } = await connected();
      expect(socket.listeners('metrics:tick')).toBe(1);

      stop();
      expect(socket.emitted.map((e) => e.event)).toEqual(['unsubscribe:metrics']);
      expect(socket.listeners('metrics:tick')).toBe(0);
      socket.push('metrics:tick', sampleAt(9));
      expect(events.filter((e) => e.kind === 'tick')).toHaveLength(0);
    });

    it('does not send unsubscribe when the socket is down', async () => {
      const { stop, socket } = await connected();
      socket.serverDisconnect();
      stop();
      expect(socket.emitted).toEqual([]);
    });

    it('stops reacting to reconnects', async () => {
      const { stop, socket } = await connected();
      stop();
      socket.serverConnect();
      expect(socket.acks).toHaveLength(1);
    });
  });

  describe('several consumers', () => {
    it('sends one subscribe:metrics per socket, however many consumers there are', async () => {
      const first = await connected();
      listen(() => tsAt(5));
      listen();
      await settle();
      expect(first.socket.acks).toHaveLength(1);
    });

    it('gives a late consumer the current window: the latest history, then the ticks since', async () => {
      const history = historyOf(samplesBetween(0, 2));
      const first = await connected(history);
      first.socket.push('metrics:tick', sampleAt(3));
      first.socket.push('metrics:tick', sampleAt(4));

      const late = listen();
      expect(late.events).toEqual([
        { kind: 'history', history },
        { kind: 'tick', sample: sampleAt(3) },
        { kind: 'tick', sample: sampleAt(4) },
      ]);
      first.socket.push('metrics:tick', sampleAt(5));
      expect(late.events[late.events.length - 1]).toEqual({ kind: 'tick', sample: sampleAt(5) });
      expect(first.events.filter((e) => e.kind === 'tick')).toHaveLength(3);
    });

    it('replays only what follows the newest history when the channel subscribed again', async () => {
      const first = await connected(historyOf(samplesBetween(0, 2)));
      first.socket.push('metrics:tick', sampleAt(3));
      first.socket.serverDisconnect();
      first.socket.serverConnect();
      const second = historyOf(samplesBetween(4, 6));
      first.socket.acks[1].resolve(ok(second));
      await settle();
      first.socket.push('metrics:tick', sampleAt(7));

      const late = listen();
      expect(late.events).toEqual([
        { kind: 'history', history: second },
        { kind: 'tick', sample: sampleAt(7) },
      ]);
    });

    it('replays at most the last 300 ticks', async () => {
      const first = await connected(historyOf([sampleAt(0)]));
      for (let i = 1; i <= 350; i++) first.socket.push('metrics:tick', sampleAt(i));

      const late = listen();
      const ticks = late.events.filter((e) => e.kind === 'tick');
      expect(late.events[0].kind).toBe('history');
      expect(ticks).toHaveLength(300);
      expect(ticks[0]).toEqual({ kind: 'tick', sample: sampleAt(51) });
    });

    it('keeps the others ticking when one consumer leaves, and sends no unsubscribe', async () => {
      const first = await connected();
      const second = listen();
      await settle();

      first.stop();
      expect(first.socket.emitted).toEqual([]);
      first.socket.push('metrics:tick', sampleAt(1));
      expect(second.events.filter((e) => e.kind === 'tick')).toEqual([
        { kind: 'tick', sample: sampleAt(1) },
      ]);
      expect(first.events.filter((e) => e.kind === 'tick')).toHaveLength(0);
    });

    it('sends unsubscribe:metrics once, when the last consumer leaves', async () => {
      const first = await connected();
      const second = listen();
      await settle();

      first.stop();
      second.stop();
      expect(first.socket.emitted.map((e) => e.event)).toEqual(['unsubscribe:metrics']);
      expect(first.socket.listeners('metrics:tick')).toBe(0);
    });

    it('subscribes again, from scratch, when a consumer comes back after all left', async () => {
      const first = await connected(historyOf([sampleAt(1)]));
      first.stop();
      const back = listen(() => tsAt(1));
      await settle();
      expect(first.socket.acks).toHaveLength(2);
      expect(first.socket.acks[1].payload).toStrictEqual({ since: tsAt(1) });
      expect(back.events).toEqual([
        { kind: 'sent', event: 'subscribe:metrics', payload: { since: tsAt(1) } },
      ]);
    });

    it('fails every consumer when the server refuses, and a later consumer tries again', async () => {
      const first = listen();
      const second = listen();
      await settle();
      const socket = sockets[0];
      socket.serverConnect();
      socket.acks[0].resolve({ ok: false, error: 'page_disabled', message: 'Page disabled' });
      await settle();
      expect(first.errors).toHaveLength(1);
      expect(second.errors).toHaveLength(1);

      const third = listen();
      await settle();
      expect(socket.acks).toHaveLength(2);
      expect(third.errors).toHaveLength(0);
    });
  });

  describe('closing the socket', () => {
    beforeEach(() => vi.useFakeTimers());

    it('disconnects 5 seconds after the last consumer left, and the status goes back to idle', async () => {
      const { stop, socket } = await connected();
      stop();
      vi.advanceTimersByTime(4_999);
      expect(socket.disconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(socket.disconnect).toHaveBeenCalledOnce();
      expect(live.status()).toBe('idle');
    });

    it('keeps the socket while another consumer is still there', async () => {
      const first = await connected();
      const second = listen();
      await settle();
      first.stop();
      vi.advanceTimersByTime(60_000);
      expect(first.socket.disconnect).not.toHaveBeenCalled();
      second.stop();
      vi.advanceTimersByTime(5_000);
      expect(first.socket.disconnect).toHaveBeenCalledOnce();
    });

    it('reuses the open socket when a consumer comes back within the 5 seconds', async () => {
      const { stop, socket } = await connected();
      stop();
      vi.advanceTimersByTime(3_000);
      listen();
      await settle();
      vi.advanceTimersByTime(60_000);
      expect(factory).toHaveBeenCalledOnce();
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(live.status()).toBe('connected');
    });

    it('opens a new socket when a consumer comes back after the 5 seconds', async () => {
      const { stop } = await connected();
      stop();
      vi.advanceTimersByTime(5_000);
      listen();
      await settle();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(live.status()).toBe('connecting');
    });

    it('stops listening to the socket events once it is closed', async () => {
      const { stop, socket } = await connected();
      stop();
      vi.advanceTimersByTime(5_000);
      expect(socket.listeners('connect')).toBe(0);
      expect(socket.listeners('disconnect')).toBe(0);
      expect(socket.listeners('connect_error')).toBe(0);
    });
  });

  describe('status', () => {
    it('is "reconnecting" after a drop, and "connected" again when it is back', async () => {
      const { socket } = await connected();
      socket.serverDisconnect('transport close');
      expect(live.status()).toBe('reconnecting');
      socket.connectError();
      socket.connectError();
      expect(live.status()).toBe('reconnecting');
      socket.serverConnect();
      expect(live.status()).toBe('connected');
    });

    it('is "offline" after 3 failed attempts in a row, and recovers when one succeeds', async () => {
      const { socket } = await connected();
      socket.serverDisconnect();
      socket.connectError();
      socket.connectError();
      socket.connectError();
      expect(live.status()).toBe('offline');
      socket.connectError();
      expect(live.status()).toBe('offline');
      socket.serverConnect();
      expect(live.status()).toBe('connected');
    });

    it('is "offline" after 3 failed attempts when it never connected', async () => {
      listen();
      await settle();
      sockets[0].connectError();
      sockets[0].connectError();
      expect(live.status()).toBe('connecting');
      sockets[0].connectError();
      expect(live.status()).toBe('offline');
    });

    it('counts failures again from zero after each drop', async () => {
      const { socket } = await connected();
      socket.serverDisconnect();
      socket.connectError();
      socket.connectError();
      socket.serverConnect();
      socket.serverDisconnect();
      socket.connectError();
      socket.connectError();
      expect(live.status()).toBe('reconnecting');
    });

    it('asks to connect again after the server closed the connection (Socket.IO does not retry that one)', async () => {
      const { socket } = await connected();
      expect(socket.connect).toHaveBeenCalledTimes(1);
      socket.serverDisconnect('io server disconnect');
      expect(socket.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('lifecycle$ (for the stream inspector)', () => {
    it('reports connects, disconnects with their reason, attempts and errors', async () => {
      const seen: LiveLifecycleEvent[] = [];
      live.lifecycle$.subscribe((e) => seen.push(e));
      listen();
      await settle();
      const socket = sockets[0];

      socket.connectError('server unreachable');
      socket.serverConnect();
      socket.serverDisconnect('ping timeout');
      socket.reconnectAttempt(1);
      socket.connectError('xhr poll error');
      socket.reconnectAttempt(2);
      socket.serverConnect();

      expect(seen).toEqual([
        { kind: 'connect_error', message: 'server unreachable' },
        { kind: 'connect' },
        { kind: 'disconnect', reason: 'ping timeout' },
        { kind: 'reconnect_attempt', attempt: 1 },
        { kind: 'connect_error', message: 'xhr poll error' },
        { kind: 'reconnect_attempt', attempt: 2 },
        { kind: 'connect' },
      ]);
    });

    it('does not report the disconnect that closing the socket causes', async () => {
      const seen: LiveLifecycleEvent[] = [];
      live.lifecycle$.subscribe((e) => seen.push(e));
      vi.useFakeTimers();
      const { stop, socket } = await connected();
      seen.length = 0;
      stop();
      vi.advanceTimersByTime(5_000);
      socket.serverDisconnect('io client disconnect');
      expect(seen).toEqual([]);
    });
  });
});
