import type { ProcessMetricsHistory, ProcessSample } from '@my-resume/api-models';
import { Subject } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import type { PreferencesService } from '../preferences/preferences.service';
import type { ProcessMetricsService } from '../site-metrics/process-metrics.service';
import { LiveGateway } from './live.gateway';

const HISTORY: ProcessMetricsHistory = {
  startedAt: '2026-11-05T09:58:00.000Z',
  intervalMs: 1000,
  samples: [],
};

function sample(ts: string): ProcessSample {
  return {
    ts,
    uptimeSeconds: 1,
    eventLoopLagMs: { p50: 0, p99: 0 },
    memoryMb: { rss: 1, heapTotal: 1, heapUsed: 1 },
    cpuPercent: 0,
    gc: { minorCount: 0, minorMs: 0, majorCount: 0, majorMs: 0 },
  };
}

function setup() {
  const samples$ = new Subject<ProcessSample>();
  const history = vi.fn<(sinceMs?: number) => ProcessMetricsHistory>().mockReturnValue(HISTORY);
  const isPageEnabled = vi.fn<(id: string) => Promise<boolean>>().mockResolvedValue(true);
  const gateway = new LiveGateway(
    { samples$, history } as unknown as ProcessMetricsService,
    { isPageEnabled } as unknown as PreferencesService,
  );

  const rooms = new Map<string, Set<string>>();
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const server = { adapter: { rooms }, to } as unknown as Namespace;
  gateway.server = server;

  return { gateway, samples$, history, isPageEnabled, rooms, emit, to };
}

function fakeClient() {
  const middlewares: ((packet: unknown[], next: (err?: Error) => void) => void)[] = [];
  const client = {
    join: vi.fn(),
    leave: vi.fn(),
    use: vi.fn((fn: (typeof middlewares)[number]) => middlewares.push(fn)),
  };
  return { client, socket: client as unknown as Socket, middlewares };
}

describe('LiveGateway', () => {
  describe('subscribe:metrics', () => {
    it('joins the metrics room and acks the history after `since`', async () => {
      const { gateway, history } = setup();
      const { client, socket } = fakeClient();

      const ack = await gateway.subscribeMetrics(socket, { since: '2026-11-05T10:00:01.000Z' });

      expect(ack).toEqual({ ok: true, data: HISTORY });
      expect(history).toHaveBeenCalledWith(Date.UTC(2026, 10, 5, 10, 0, 1));
      expect(client.join).toHaveBeenCalledWith('metrics');
    });

    it('acks the whole buffer for {}', async () => {
      const { gateway, history } = setup();
      await gateway.subscribeMetrics(fakeClient().socket, {});
      expect(history).toHaveBeenCalledWith(undefined);
    });

    it('answers invalid_message to an invalid payload, without joining or reading preferences', async () => {
      const { gateway, isPageEnabled } = setup();
      const { client, socket } = fakeClient();

      const ack = await gateway.subscribeMetrics(socket, { since: 'yesterday' });

      expect(ack).toEqual({ ok: false, error: 'invalid_message', message: expect.any(String) });
      expect(client.join).not.toHaveBeenCalled();
      expect(isPageEnabled).not.toHaveBeenCalled();
    });

    it('answers page_disabled while the siteMetrics page is disabled, without joining', async () => {
      const { gateway, isPageEnabled, history } = setup();
      isPageEnabled.mockResolvedValue(false);
      const { client, socket } = fakeClient();

      const ack = await gateway.subscribeMetrics(socket, {});

      expect(isPageEnabled).toHaveBeenCalledWith('siteMetrics');
      expect(ack).toEqual({ ok: false, error: 'page_disabled', message: 'This page is disabled' });
      expect(client.join).not.toHaveBeenCalled();
      expect(history).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe:metrics', () => {
    it('leaves the metrics room and acks null', async () => {
      const { gateway } = setup();
      const { client, socket } = fakeClient();
      expect(await gateway.unsubscribeMetrics(socket)).toEqual({ ok: true, data: null });
      expect(client.leave).toHaveBeenCalledWith('metrics');
    });
  });

  describe('metrics:tick', () => {
    it('emits each sample to the metrics room while it has members', () => {
      const { gateway, samples$, rooms, to, emit } = setup();
      gateway.afterInit();
      rooms.set('metrics', new Set(['socket-1']));

      samples$.next(sample('2026-11-05T10:00:01.000Z'));

      expect(to).toHaveBeenCalledWith('metrics');
      expect(emit).toHaveBeenCalledWith('metrics:tick', sample('2026-11-05T10:00:01.000Z'));
    });

    it('sends nothing while nobody is subscribed', () => {
      const { gateway, samples$, rooms, to } = setup();
      gateway.afterInit();
      samples$.next(sample('2026-11-05T10:00:01.000Z'));
      rooms.set('metrics', new Set());
      samples$.next(sample('2026-11-05T10:00:02.000Z'));
      expect(to).not.toHaveBeenCalled();
    });

    it('stops listening to samples on shutdown', () => {
      const { gateway, samples$, rooms, to } = setup();
      gateway.afterInit();
      rooms.set('metrics', new Set(['socket-1']));
      gateway.onModuleDestroy();
      samples$.next(sample('2026-11-05T10:00:01.000Z'));
      expect(to).not.toHaveBeenCalled();
      expect(samples$.observed).toBe(false);
    });
  });

  describe('message rate limit (per connection)', () => {
    it('passes 20 messages per second, then drops the others and acks rate_limited', () => {
      const { gateway } = setup();
      const { socket, middlewares } = fakeClient();
      gateway.handleConnection(socket);
      expect(middlewares).toHaveLength(1);

      const next = vi.fn();
      const acks = Array.from({ length: 25 }, () => vi.fn());
      acks.forEach((ack) => middlewares[0](['subscribe:metrics', {}, ack], next));

      expect(next).toHaveBeenCalledTimes(20);
      expect(next.mock.calls.every((args) => args.length === 0)).toBe(true);
      acks.slice(0, 20).forEach((ack) => expect(ack).not.toHaveBeenCalled());
      acks.slice(20).forEach((ack) =>
        expect(ack).toHaveBeenCalledWith({
          ok: false,
          error: 'rate_limited',
          message: expect.any(String),
        }),
      );
    });

    it('drops an extra message without an ack silently', () => {
      const { gateway } = setup();
      const { socket, middlewares } = fakeClient();
      gateway.handleConnection(socket);
      const next = vi.fn();
      for (let i = 0; i < 21; i++) middlewares[0](['unsubscribe:metrics'], next);
      expect(next).toHaveBeenCalledTimes(20);
    });

    it('limits each connection separately', () => {
      const { gateway } = setup();
      const a = fakeClient();
      const b = fakeClient();
      gateway.handleConnection(a.socket);
      gateway.handleConnection(b.socket);
      const next = vi.fn();
      for (let i = 0; i < 20; i++) a.middlewares[0](['x'], next);
      b.middlewares[0](['x'], next);
      expect(next).toHaveBeenCalledTimes(21);
    });
  });
});
