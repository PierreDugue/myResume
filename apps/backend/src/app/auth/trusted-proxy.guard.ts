import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AllowDirectAccess } from './allow-direct-access.decorator';
import { ProxyTrust } from './proxy-trust';

export { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from './proxy-trust';

/** `clientIp`: the visitor's IP as vouched for by nginx; set only on requests with the secret. */
export type ProxiedRequest = Request & { clientIp?: string };

/**
 * Global guard applying the proxy-secret rule (ProxyTrust) to HTTP requests: when PROXY_SECRET is
 * set, requests without the secret get 403 unless the route is @AllowDirectAccess(), and the
 * X-Client-IP nginx sent becomes `request.clientIp`, for rate limiting.
 * Socket.IO connections get the same check at the handshake (LiveIoAdapter).
 */
@Injectable()
export class TrustedProxyGuard implements CanActivate {
  constructor(
    private readonly proxyTrust: ProxyTrust,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ProxiedRequest>();
    const { allowed, clientIp } = this.proxyTrust.check(request.headers);
    if (clientIp) request.clientIp = clientIp;
    if (allowed) return true;

    const directAccess = this.reflector.getAllAndOverride(AllowDirectAccess, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (directAccess) return true;
    throw new ForbiddenException();
  }
}
