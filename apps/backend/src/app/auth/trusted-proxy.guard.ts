import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { AppEnv } from '../config/env.validation';
import { AllowDirectAccess } from './allow-direct-access.decorator';

/** Headers nginx sets on every /api request (see apps/frontend/nginx.conf.template). */
export const PROXY_SECRET_HEADER = 'x-proxy-secret';
export const CLIENT_IP_HEADER = 'x-client-ip';

/** `clientIp`: the visitor's IP as vouched for by nginx; set only on requests with the secret. */
export type ProxiedRequest = Request & { clientIp?: string };

/**
 * Global guard, for hosts where nginx reaches the backend through a public address (Render).
 * When PROXY_SECRET is set, only requests carrying it (i.e. coming through nginx) are answered,
 * and the visitor IP nginx sends in X-Client-IP becomes trustworthy, for rate limiting.
 * Without PROXY_SECRET (local dev, Docker Compose) it lets everything through and ignores those
 * headers, which anyone could send.
 */
@Injectable()
export class TrustedProxyGuard implements CanActivate {
  private readonly secretDigest: Buffer | null;

  constructor(
    config: ConfigService<AppEnv, true>,
    private readonly reflector: Reflector,
  ) {
    const secret = config.get('PROXY_SECRET', { infer: true });
    this.secretDigest = secret ? digest(secret) : null;
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.secretDigest === null) return true;

    const request = context.switchToHttp().getRequest<ProxiedRequest>();
    const sent = request.headers[PROXY_SECRET_HEADER];
    // Digests have the same length whatever was sent, so the comparison takes constant time.
    if (typeof sent === 'string' && timingSafeEqual(digest(sent), this.secretDigest)) {
      const clientIp = request.headers[CLIENT_IP_HEADER];
      if (typeof clientIp === 'string' && isIP(clientIp.trim())) {
        request.clientIp = clientIp.trim();
      }
      return true;
    }

    const allowed = this.reflector.getAllAndOverride(AllowDirectAccess, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    throw new ForbiddenException();
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
