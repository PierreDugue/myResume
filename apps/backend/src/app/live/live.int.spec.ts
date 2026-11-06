import type {
  LiveAck,
  LiveClientEvents,
  LiveServerEvents,
  ProcessMetricsHistory,
  ProcessSample,
} from '@my-resume/api-models';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

type LiveSocket = Socket<LiveServerEvents, LiveClientEvents>;

/** Generous on purpose: waits for an event end as soon as it arrives, so this only matters when the machine is slow. */
const EVENT_TIMEOUT_MS = 10_000;
/** How long to listen when the point is that nothing arrives (several ticks' worth). */
const SILENCE_MS = 1500;

describe('Live (Socket.IO /live): metrics channel', () => {
  let t: TestApp;
  let http: Api;
  let url: string;
  let socket: LiveSocket;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t);
    // The real configuration (configureApp: LiveIoAdapter) on a real port.
    await t.app.listen(0, '127.0.0.1');
    const { port } = t.app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}/live`;
  });
  afterAll(() => t?.close());

  beforeEach(async () => {
    // Through the API, not a DELETE: the service caches the page flags for 5 s and only update()
    // clears that cache, so a row removed behind its back could leave a previous test's flag in force.
    await http.patch('/api/preferences', { pages: { siteMetrics: true } });
    socket = io(url, { path: '/api/socket.io', transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
  });
  afterEach(() => socket.disconnect());

  const subscribe = (request: unknown): Promise<LiveAck<ProcessMetricsHistory>> =>
    // Untyped emit: some tests send what a typed client couldn't.
    (socket as unknown as Socket).timeout(2000).emitWithAck('subscribe:metrics', request);

  const nextTick = (timeoutMs: number) =>
    new Promise<ProcessSample | null>((resolve) => {
      const timer = setTimeout(() => {
        socket.off('metrics:tick', onTick);
        resolve(null);
      }, timeoutMs);
      const onTick = (sample: ProcessSample) => {
        clearTimeout(timer);
        resolve(sample);
      };
      socket.once('metrics:tick', onTick);
    });

  it('acks the history on subscribe:metrics {}, then pushes metrics:tick every second', async () => {
    const ack = await subscribe({});
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.data.intervalMs).toBe(1000);
    expect(Array.isArray(ack.data.samples)).toBe(true);
    expect(Number.isNaN(Date.parse(ack.data.startedAt))).toBe(false);

    const tick = await nextTick(EVENT_TIMEOUT_MS);
    expect(tick).not.toBeNull();
    expect(Object.keys(tick ?? {}).sort()).toEqual(
      ['cpuPercent', 'eventLoopLagMs', 'gc', 'memoryMb', 'ts', 'uptimeSeconds'].sort(),
    );
    const last = ack.data.samples.at(-1);
    if (last && tick) expect(Date.parse(tick.ts)).toBeGreaterThan(Date.parse(last.ts));
  });

  it('acks only the samples after `since`', async () => {
    // The buffer fills one sample per second: wait for two, whatever the machine's speed.
    const all = await vi.waitFor(
      async () => {
        const ack = await subscribe({});
        if (!ack.ok) throw new Error('subscribe failed');
        if (ack.data.samples.length < 2) throw new Error('fewer than 2 samples yet');
        return ack;
      },
      { timeout: EVENT_TIMEOUT_MS, interval: 200 },
    );
    const cursor = all.data.samples.at(-2)?.ts as string;

    const after = await subscribe({ since: cursor });
    if (!after.ok) throw new Error('subscribe failed');
    // The newest sample at the first call is after the cursor and stays in the buffer.
    expect(after.data.samples.length).toBeGreaterThanOrEqual(1);
    expect(after.data.samples.every((s) => Date.parse(s.ts) > Date.parse(cursor))).toBe(true);

    const future = await subscribe({ since: '2999-01-01T00:00:00.000Z' });
    expect(future).toMatchObject({ ok: true, data: { samples: [] } });
  });

  it.each([
    ['an unparseable since', { since: 'yesterday' }],
    ['a since longer than 40 characters', { since: `2026-11-05T10:00:00.${'0'.repeat(30)}Z` }],
    ['an unknown key', { limit: 5 }],
    ['a non-object payload', 'hello'],
    ['null', null],
  ])('answers invalid_message to %s, and sends no ticks', async (_case, payload) => {
    const ack = await subscribe(payload);
    expect(ack).toEqual({ ok: false, error: 'invalid_message', message: expect.any(String) });
    expect(await nextTick(SILENCE_MS)).toBeNull();
  });

  it('answers page_disabled while siteMetrics is disabled, and sends no ticks', async () => {
    await http.patch('/api/preferences', { pages: { siteMetrics: false } });
    const ack = await subscribe({});
    expect(ack).toEqual({ ok: false, error: 'page_disabled', message: 'This page is disabled' });
    expect(await nextTick(SILENCE_MS)).toBeNull();
  });

  it('stops the ticks after unsubscribe:metrics', async () => {
    expect((await subscribe({})).ok).toBe(true);
    expect(await nextTick(EVENT_TIMEOUT_MS)).not.toBeNull();

    const ack = await socket.timeout(2000).emitWithAck('unsubscribe:metrics');
    expect(ack).toEqual({ ok: true, data: null });
    expect(await nextTick(SILENCE_MS)).toBeNull();
  });

  it('answers rate_limited to messages over 20 per second', async () => {
    const acks = await Promise.all(
      Array.from({ length: 25 }, () => socket.timeout(2000).emitWithAck('unsubscribe:metrics')),
    );
    const limited = acks.filter((a) => !a.ok);
    expect(limited.length).toBeGreaterThanOrEqual(5);
    expect(limited[0]).toEqual({ ok: false, error: 'rate_limited', message: expect.any(String) });
    expect(acks.filter((a) => a.ok).length).toBeLessThanOrEqual(20);
  });

  it('refuses a handshake on another path', async () => {
    const other = io(url, { path: '/socket.io', transports: ['websocket'], reconnection: false });
    const result = await new Promise<string>((resolve) => {
      other.once('connect', () => resolve('connected'));
      other.once('connect_error', () => resolve('refused'));
    });
    other.disconnect();
    expect(result).toBe('refused');
  });
});
