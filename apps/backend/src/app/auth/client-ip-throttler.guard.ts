import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ProxiedRequest } from './trusted-proxy.guard';

/**
 * Rate limiting per visitor: the IP nginx vouched for (set by TrustedProxyGuard, which must run
 * first), otherwise the request IP that Express derives from X-Forwarded-For (see app.setup.ts).
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as ProxiedRequest;
    return request.clientIp ?? request.ip ?? '';
  }
}
