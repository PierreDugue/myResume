import { ProxyTrust } from './proxy-trust';

const SECRET = 'proxy-secret-that-is-at-least-32-characters';

describe('ProxyTrust', () => {
  describe('with a secret (PROXY_SECRET set)', () => {
    const trust = new ProxyTrust(SECRET);

    it('allows a request carrying the secret', () => {
      expect(trust.check({ 'x-proxy-secret': SECRET })).toEqual({ allowed: true });
    });

    it('vouches for X-Client-IP when the secret is valid (trimmed)', () => {
      expect(trust.check({ 'x-proxy-secret': SECRET, 'x-client-ip': ' 203.0.113.1 ' })).toEqual({
        allowed: true,
        clientIp: '203.0.113.1',
      });
      expect(trust.check({ 'x-proxy-secret': SECRET, 'x-client-ip': '2001:db8::2' })).toEqual({
        allowed: true,
        clientIp: '2001:db8::2',
      });
    });

    it('ignores an X-Client-IP that is not an IP', () => {
      expect(trust.check({ 'x-proxy-secret': SECRET, 'x-client-ip': 'not-an-ip' })).toEqual({
        allowed: true,
      });
    });

    it.each([
      ['no secret', {}],
      ['a wrong secret of the same length', { 'x-proxy-secret': 'x'.repeat(SECRET.length) }],
      ['a shorter secret', { 'x-proxy-secret': SECRET.slice(0, 10) }],
      ['a longer secret', { 'x-proxy-secret': `${SECRET}x` }],
      ['a repeated header', { 'x-proxy-secret': [SECRET, SECRET] }],
    ])('refuses %s', (_case, headers) => {
      expect(trust.check(headers)).toEqual({ allowed: false });
    });

    it('never vouches for X-Client-IP without the secret', () => {
      expect(trust.check({ 'x-client-ip': '203.0.113.1' })).toEqual({ allowed: false });
    });
  });

  describe('without a secret (local dev, Docker Compose)', () => {
    it.each([undefined, ''])('allows everything and ignores both headers (secret %j)', (secret) => {
      const trust = new ProxyTrust(secret);
      expect(trust.check({})).toEqual({ allowed: true });
      expect(trust.check({ 'x-proxy-secret': 'anything', 'x-client-ip': '203.0.113.1' })).toEqual({
        allowed: true,
      });
    });
  });
});
