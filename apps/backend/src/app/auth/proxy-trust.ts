import type { IncomingHttpHeaders } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

/** Headers nginx sets on every /api request (see apps/frontend/nginx.conf.template). */
export const PROXY_SECRET_HEADER = 'x-proxy-secret';
export const CLIENT_IP_HEADER = 'x-client-ip';

export interface ProxyCheck {
  /** false only when PROXY_SECRET is set and the request lacks the valid secret. */
  allowed: boolean;
  /** The visitor's IP as vouched for by nginx; set only on requests with the secret. */
  clientIp?: string;
}

/**
 * The proxy-secret rule, for hosts where nginx reaches the backend through a public address
 * (Render), shared by HTTP (TrustedProxyGuard) and the Socket.IO handshake (LiveIoAdapter).
 * With a secret, only requests carrying it are allowed, and only then is X-Client-IP trusted.
 * Without one (local dev, Docker Compose) everything is allowed and both headers are ignored,
 * since anyone could send them.
 */
export class ProxyTrust {
  private readonly secretDigest: Buffer | null;

  constructor(secret: string | undefined) {
    this.secretDigest = secret ? digest(secret) : null;
  }

  check(headers: IncomingHttpHeaders): ProxyCheck {
    if (this.secretDigest === null) return { allowed: true };
    const sent = headers[PROXY_SECRET_HEADER];
    // Digests have the same length whatever was sent, so the comparison takes constant time.
    if (typeof sent !== 'string' || !timingSafeEqual(digest(sent), this.secretDigest)) {
      return { allowed: false };
    }
    const clientIp = headers[CLIENT_IP_HEADER];
    if (typeof clientIp === 'string' && isIP(clientIp.trim())) {
      return { allowed: true, clientIp: clientIp.trim() };
    }
    return { allowed: true };
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
