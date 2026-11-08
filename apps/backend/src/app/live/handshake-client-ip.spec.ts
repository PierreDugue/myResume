import type { IncomingHttpHeaders } from 'node:http';
import { handshakeClientIp } from './handshake-client-ip';

function req(remoteAddress: string | undefined, forwardedFor?: string | string[]) {
  const headers: IncomingHttpHeaders = {};
  if (forwardedFor !== undefined) headers['x-forwarded-for'] = forwardedFor as string;
  return { headers, socket: { remoteAddress } };
}

/** Same result as Express's req.ip with `trust proxy 'loopback, uniquelocal'` (app.setup.ts). */
describe('handshakeClientIp', () => {
  it('uses the IP the trusted proxy vouched for (X-Client-IP with the proxy secret)', () => {
    expect(handshakeClientIp(req('10.0.0.5', '198.51.100.7'), '203.0.113.9')).toBe('203.0.113.9');
  });

  it('uses the remote address of a direct, untrusted connection', () => {
    expect(handshakeClientIp(req('203.0.113.1'))).toBe('203.0.113.1');
  });

  it('ignores X-Forwarded-For sent by an untrusted remote (spoofing)', () => {
    expect(handshakeClientIp(req('203.0.113.1', '198.51.100.7'))).toBe('203.0.113.1');
    expect(handshakeClientIp(req('2001:db8::1', '127.0.0.1'))).toBe('2001:db8::1');
  });

  it('takes the visitor IP added by a trusted proxy (nginx on the Docker network)', () => {
    expect(handshakeClientIp(req('172.18.0.3', '203.0.113.1'))).toBe('203.0.113.1');
  });

  it('walks from the right and stops at the first untrusted address', () => {
    // The visitor sent a fake X-Forwarded-For; nginx appended the real address.
    expect(handshakeClientIp(req('127.0.0.1', '1.2.3.4, 203.0.113.1, 10.0.0.2'))).toBe(
      '203.0.113.1',
    );
  });

  it('joins repeated X-Forwarded-For headers in order', () => {
    expect(handshakeClientIp(req('10.0.0.1', ['1.2.3.4', '203.0.113.1']))).toBe('203.0.113.1');
  });

  it('returns the leftmost address when every hop is trusted (a visitor on the LAN)', () => {
    expect(handshakeClientIp(req('127.0.0.1', '192.168.1.20, 10.0.0.2'))).toBe('192.168.1.20');
    expect(handshakeClientIp(req('::1'))).toBe('::1');
  });

  it.each([
    ['127.0.0.0/8', '127.10.0.1'],
    ['::1', '::1'],
    ['10/8', '10.255.0.1'],
    ['172.16/12', '172.31.255.254'],
    ['192.168/16', '192.168.0.1'],
    ['fc00::/7', 'fd12:3456::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped private', '::ffff:10.1.2.3'],
  ])('trusts a %s proxy', (_range, proxy) => {
    expect(handshakeClientIp(req(proxy, '203.0.113.1'))).toBe('203.0.113.1');
  });

  it.each([
    ['172.32.0.1', '172.32.0.1'],
    ['a public IPv4-mapped address', '::ffff:203.0.113.5'],
    ['a public IPv6', '2001:db8::5'],
    ['169.254 link-local (not in uniquelocal)', '169.254.1.1'],
  ])('does not trust %s', (_case, remote) => {
    expect(handshakeClientIp(req(remote, '198.51.100.7'))).toBe(remote);
  });

  it('trims spaces around X-Forwarded-For entries', () => {
    expect(handshakeClientIp(req('10.0.0.1', '  203.0.113.1  ,  10.0.0.2 '))).toBe('203.0.113.1');
  });

  it('treats a non-IP entry as untrusted and returns it, as Express does', () => {
    expect(handshakeClientIp(req('10.0.0.1', 'garbage'))).toBe('garbage');
  });

  it('returns an empty string when the socket has no remote address', () => {
    expect(handshakeClientIp(req(undefined))).toBe('');
  });
});
