import { Reflector } from '@nestjs/core';

/**
 * Marks a route (or controller) as reachable without the proxy secret (see TrustedProxyGuard).
 * Only for platform health checks, which call the backend directly instead of through nginx.
 */
export const AllowDirectAccess = Reflector.createDecorator<void, boolean>({
  transform: () => true,
});
