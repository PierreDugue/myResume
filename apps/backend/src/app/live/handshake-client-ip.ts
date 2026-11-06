import type { IncomingHttpHeaders } from 'node:http';
import { BlockList, isIP } from 'node:net';

/**
 * The proxies Express trusts with `trust proxy 'loopback, uniquelocal'` (app.setup.ts): nginx on
 * the Docker network and the dev proxy. BlockList also matches the IPv4-mapped IPv6 forms
 * (`::ffff:10.0.0.1`).
 */
const TRUSTED_PROXIES = new BlockList();
TRUSTED_PROXIES.addSubnet('127.0.0.0', 8, 'ipv4');
TRUSTED_PROXIES.addAddress('::1', 'ipv6');
TRUSTED_PROXIES.addSubnet('10.0.0.0', 8, 'ipv4');
TRUSTED_PROXIES.addSubnet('172.16.0.0', 12, 'ipv4');
TRUSTED_PROXIES.addSubnet('192.168.0.0', 16, 'ipv4');
TRUSTED_PROXIES.addSubnet('fc00::', 7, 'ipv6');

function isTrustedProxy(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  return TRUSTED_PROXIES.check(address, version === 4 ? 'ipv4' : 'ipv6');
}

/**
 * The visitor IP of a Socket.IO handshake, as Express computes `req.ip` for HTTP requests:
 * - the IP nginx vouched for in X-Client-IP, when ProxyTrust validated the proxy secret;
 * - otherwise the socket's remote address and then X-Forwarded-For from the right: the first
 *   address that isn't a trusted proxy (so an untrusted client can't spoof it), or the leftmost
 *   one when every hop is trusted.
 * The result stays in memory (connection counting): never log or emit it.
 */
export function handshakeClientIp(
  request: { headers: IncomingHttpHeaders; socket: { remoteAddress?: string } },
  vouchedIp?: string,
): string {
  if (vouchedIp) return vouchedIp;
  const remote = request.socket.remoteAddress ?? '';
  const header = request.headers['x-forwarded-for'];
  const forwarded = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  const hops = [remote, ...forwarded.reverse()];
  for (let i = 0; i < hops.length - 1; i++) {
    if (!isTrustedProxy(hops[i])) return hops[i];
  }
  return hops[hops.length - 1];
}
