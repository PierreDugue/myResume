import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { AdminUser } from '../auth/entities/admin-user.entity';
import { Public } from '../auth/public.decorator';
import type { AppEnv } from '../config/env.validation';
import { LiveIoAdapter } from './live-io.adapter';

const SECRET = 'proxy-secret-that-is-at-least-32-characters';
const env: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 5432,
  DATABASE_USER: 'u',
  DATABASE_PASSWORD: 'p',
  DATABASE_NAME: 'd',
  DATABASE_SSL: false,
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars!',
  PASSWORD_PEPPER: 'test-pepper-that-is-at-least-32-chars!',
};

@Public()
@WebSocketGateway({ namespace: '/public-probe' })
class PublicProbeGateway {
  @SubscribeMessage('ping')
  ping() {
    return { pong: true };
  }
}

/** Not @Public(): shows whether the global JwtAuthGuard runs on gateway handlers. */
@WebSocketGateway({ namespace: '/private-probe' })
class PrivateProbeGateway {
  @SubscribeMessage('ping')
  ping() {
    return { pong: true };
  }
}

type ClientOptions = Partial<ManagerOptions & SocketOptions>;

/**
 * The Socket.IO server configuration (LiveIoAdapter, wired by configureApp): path, handshake checks
 * (proxy secret, connections per IP), message size, and whether the global guards reach gateways.
 */
describe('LiveIoAdapter and the global guards on gateways', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];

  async function start(options: { proxySecret?: string; maxConnectionsPerIp?: number } = {}) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () => ({
            ...env,
            ...(options.proxySecret && { PROXY_SECRET: options.proxySecret }),
          }),
        }),
        AuthModule,
      ],
      providers: [PublicProbeGateway, PrivateProbeGateway],
    })
      .overrideProvider(getRepositoryToken(AdminUser))
      .useValue({
        findOneBy: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        save: vi.fn(),
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    if (options.maxConnectionsPerIp !== undefined) {
      app.useWebSocketAdapter(
        new LiveIoAdapter(app, { maxConnectionsPerIp: options.maxConnectionsPerIp }),
      );
    }
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  }

  function client(namespace: string, options: ClientOptions = {}): Socket {
    const socket = io(`${url}${namespace}`, {
      path: '/api/socket.io',
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      ...options,
    });
    sockets.push(socket);
    return socket;
  }

  /** Resolves 'connected', or the connect_error. */
  function connect(socket: Socket): Promise<'connected' | Error> {
    return new Promise((resolve) => {
      socket.once('connect', () => resolve('connected'));
      socket.once('connect_error', (err) => resolve(err));
    });
  }

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await app?.close();
    delete process.env['PROXY_SECRET'];
  });

  describe('server options', () => {
    beforeEach(() => start());

    it('serves Socket.IO on /api/socket.io', async () => {
      expect(await connect(client('/public-probe'))).toBe('connected');
    });

    it('does not answer on the default /socket.io path', async () => {
      const result = await connect(client('/public-probe', { path: '/socket.io' }));
      expect(result).toBeInstanceOf(Error);
    });

    it('does not serve the Socket.IO client bundle', async () => {
      const res = await request(app.getHttpServer()).get('/api/socket.io/socket.io.js');
      expect(res.status).not.toBe(200);
      expect(res.text).not.toContain('function');
    });

    it('closes the connection on a message larger than 4 kB', async () => {
      const socket = client('/public-probe');
      await connect(socket);
      const disconnected = new Promise<string>((resolve) => socket.once('disconnect', resolve));
      socket.emit('ping', 'x'.repeat(5000));
      expect(await disconnected).toBeTruthy();
    });

    it('accepts a message under 4 kB', async () => {
      const socket = client('/public-probe');
      await connect(socket);
      expect(await socket.timeout(1000).emitWithAck('ping', 'x'.repeat(3000))).toEqual({
        pong: true,
      });
    });
  });

  /**
   * Nest 11.2's websockets package builds its guard (and pipe, filter) context without the app
   * config, so app-wide guards (APP_GUARD, useGlobalGuards) never run on gateway handlers. Pinned
   * here so a Nest upgrade that changes it gets noticed: gateways must bind their guards
   * themselves, and the handshake checks live in LiveIoAdapter.
   */
  describe('global APP_GUARDs and gateway message handlers', () => {
    it('do not run: a handler that is not @Public() is still answered (JwtAuthGuard not applied)', async () => {
      await start();
      const socket = client('/private-probe');
      expect(await connect(socket)).toBe('connected');
      expect(await socket.timeout(1000).emitWithAck('ping', {})).toEqual({ pong: true });
    });

    it('do not run with PROXY_SECRET set either: only the handshake is checked', async () => {
      await start({ proxySecret: SECRET });
      const socket = client('/public-probe', { extraHeaders: { 'x-proxy-secret': SECRET } });
      expect(await connect(socket)).toBe('connected');
      for (let i = 0; i < 3; i++) {
        expect(await socket.timeout(1000).emitWithAck('ping', {})).toEqual({ pong: true });
      }
    });
  });

  describe('with PROXY_SECRET set', () => {
    beforeEach(() => start({ proxySecret: SECRET }));

    it('refuses a handshake without the secret with 403', async () => {
      const result = await connect(client('/public-probe', { transports: ['polling'] }));
      expect(result).toBeInstanceOf(Error);
      expect((result as Error & { description?: unknown }).description).toBe(403);
    });

    it.each([
      ['a wrong secret', 'x'.repeat(SECRET.length)],
      ['a shorter secret', SECRET.slice(0, 10)],
    ])('refuses a handshake with %s', async (_case, secret) => {
      const result = await connect(
        client('/public-probe', { extraHeaders: { 'x-proxy-secret': secret } }),
      );
      expect(result).toBeInstanceOf(Error);
    });

    it('accepts a handshake carrying the secret', async () => {
      const socket = client('/public-probe', { extraHeaders: { 'x-proxy-secret': SECRET } });
      expect(await connect(socket)).toBe('connected');
    });

    it('upgrades a polling handshake carrying the secret to websocket (both requests are checked)', async () => {
      const socket = client('/public-probe', {
        transports: ['polling', 'websocket'],
        extraHeaders: { 'x-proxy-secret': SECRET },
      });
      // The engine starts on polling and upgrades once connected.
      const upgraded = new Promise<string>((resolve) =>
        socket.io.engine.once('upgrade', (transport: { name: string }) => resolve(transport.name)),
      );
      expect(await connect(socket)).toBe('connected');
      expect(await upgraded).toBe('websocket');
      expect(await socket.timeout(1000).emitWithAck('ping', {})).toEqual({ pong: true });
    });
  });

  describe('open connections per visitor IP, with PROXY_SECRET set', () => {
    beforeEach(() => start({ proxySecret: SECRET, maxConnectionsPerIp: 1 }));

    const from = (ip: string) =>
      client('/public-probe', {
        extraHeaders: { 'x-proxy-secret': SECRET, 'x-client-ip': ip },
      });

    it('counts per X-Client-IP, as nginx vouches for it', async () => {
      expect(await connect(from('203.0.113.1'))).toBe('connected');
      expect(await connect(from('203.0.113.1'))).toBeInstanceOf(Error);
      expect(await connect(from('203.0.113.2'))).toBe('connected');
    });

    it('ignores X-Client-IP on a handshake without the secret (it is refused anyway)', async () => {
      const result = await connect(
        client('/public-probe', { extraHeaders: { 'x-client-ip': '203.0.113.9' } }),
      );
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('without PROXY_SECRET', () => {
    beforeEach(() => start());

    it('accepts a handshake without the secret', async () => {
      expect(await connect(client('/public-probe'))).toBe('connected');
    });
  });

  describe('open connections per visitor IP, without PROXY_SECRET', () => {
    beforeEach(() => start({ maxConnectionsPerIp: 1 }));

    it('ignores X-Client-IP, which anyone could send: one IP, one slot', async () => {
      const from = (ip: string) =>
        client('/public-probe', { extraHeaders: { 'x-client-ip': ip, 'x-proxy-secret': SECRET } });
      expect(await connect(from('203.0.113.1'))).toBe('connected');
      expect(await connect(from('203.0.113.2'))).toBeInstanceOf(Error);
    });
  });

  describe('open connections per visitor IP', () => {
    beforeEach(() => start({ maxConnectionsPerIp: 2 }));

    it('refuses connections over the cap at the handshake, on any namespace', async () => {
      expect(await connect(client('/public-probe'))).toBe('connected');
      expect(await connect(client('/private-probe'))).toBe('connected');
      expect(await connect(client('/public-probe'))).toBeInstanceOf(Error);
    });

    it('counts per visitor IP (X-Forwarded-For from a trusted local proxy)', async () => {
      const from = (ip: string) =>
        client('/public-probe', { extraHeaders: { 'x-forwarded-for': ip } });
      expect(await connect(from('203.0.113.1'))).toBe('connected');
      expect(await connect(from('203.0.113.1'))).toBe('connected');
      expect(await connect(from('203.0.113.1'))).toBeInstanceOf(Error);
      expect(await connect(from('203.0.113.2'))).toBe('connected');
    });

    it('frees a slot when a connection closes', async () => {
      const first = client('/public-probe');
      expect(await connect(first)).toBe('connected');
      expect(await connect(client('/public-probe'))).toBe('connected');
      first.disconnect();

      // The server sees the close asynchronously: retry briefly.
      let result: 'connected' | Error = new Error('not tried');
      const end = Date.now() + 2000;
      while (result !== 'connected' && Date.now() < end) {
        result = await connect(client('/public-probe'));
        if (result !== 'connected') await new Promise((r) => setTimeout(r, 25));
      }
      expect(result).toBe('connected');
    });
  });
});
