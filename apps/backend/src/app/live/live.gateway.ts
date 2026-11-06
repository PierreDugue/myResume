import { OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  LiveAck,
  LiveClientEvents,
  LiveServerEvents,
  ProcessMetricsHistory,
} from '@my-resume/api-models';
import { performance } from 'node:perf_hooks';
import type { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import { PreferencesService } from '../preferences/preferences.service';
import { PAGE_DISABLED_MESSAGE } from '../preferences/page-enabled.guard';
import { ProcessMetricsService } from '../site-metrics/process-metrics.service';
import { parseSubscribeMetrics } from './live-messages';
import { MessageRateLimiter } from './message-rate-limiter';

export const METRICS_ROOM = 'metrics';

type LiveSocket = Socket<LiveClientEvents, LiveServerEvents>;

/**
 * The `/live` namespace (docs/api-contract.md, Real-time): public, read-only channels, one room
 * each. Routing, validation, room membership and mapping only; the data comes from the services.
 * Path, message size and handshake checks come from LiveIoAdapter.
 *
 * App-wide guards, pipes and filters don't reach gateway handlers in Nest 11 (see
 * live-io.adapter.e2e.spec.ts), so no guard (JwtAuthGuard included) runs here: every handler of this
 * gateway is public by construction, and so there is no @Public() on it (it would only be a label
 * nothing reads). Messages are validated here (pure parsers, answering in the ack) and rate-limited
 * per connection. A future socket handler that must not be public has to bind its own guard with
 * @UseGuards(); the app-wide JwtAuthGuard will not protect it.
 */
@WebSocketGateway({ namespace: '/live' })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server!: Namespace<LiveClientEvents, LiveServerEvents>;

  private ticks: Subscription | null = null;

  constructor(
    private readonly metrics: ProcessMetricsService,
    private readonly preferences: PreferencesService,
  ) {}

  afterInit(): void {
    this.ticks = this.metrics.samples$.subscribe((sample) => {
      // Nothing is sent while nobody is subscribed.
      if (!this.server.adapter.rooms.get(METRICS_ROOM)?.size) return;
      this.server.to(METRICS_ROOM).emit('metrics:tick', sample);
    });
  }

  onModuleDestroy(): void {
    this.ticks?.unsubscribe();
    this.ticks = null;
  }

  /**
   * At most 20 messages per second per connection: extra packets are dropped before any handler,
   * and answered `rate_limited` when they carry an ack. The limiter lives in the socket's
   * middleware closure, so nothing outlives the connection.
   */
  handleConnection(client: LiveSocket): void {
    const limiter = new MessageRateLimiter({ now: () => performance.now() });
    client.use((packet, next) => {
      if (limiter.tryConsume()) return next();
      const ack: unknown = packet[packet.length - 1];
      if (typeof ack === 'function') {
        const response: LiveAck<never> = {
          ok: false,
          error: 'rate_limited',
          message: 'Too many messages: at most 20 per second',
        };
        ack(response);
      }
    });
  }

  @SubscribeMessage('subscribe:metrics')
  async subscribeMetrics(
    @ConnectedSocket() client: LiveSocket,
    @MessageBody() payload: unknown,
  ): Promise<LiveAck<ProcessMetricsHistory>> {
    const request = parseSubscribeMetrics(payload);
    if ('error' in request) {
      return { ok: false, error: 'invalid_message', message: request.error };
    }
    // Sockets carry no token: a disabled page is refused to everyone (one read per subscribe).
    if (!(await this.preferences.isPageEnabled('siteMetrics'))) {
      return { ok: false, error: 'page_disabled', message: PAGE_DISABLED_MESSAGE };
    }
    await client.join(METRICS_ROOM);
    return { ok: true, data: this.metrics.history(request.sinceMs) };
  }

  @SubscribeMessage('unsubscribe:metrics')
  async unsubscribeMetrics(@ConnectedSocket() client: LiveSocket): Promise<LiveAck<null>> {
    await client.leave(METRICS_ROOM);
    return { ok: true, data: null };
  }
}
