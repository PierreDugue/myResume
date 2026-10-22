/** Builds an unsigned JWT-shaped token for tests (the frontend never verifies signatures). */
export function fakeJwt(claims: { sub?: string; email?: string; exp: number }): string {
  const enc = (v: object) =>
    btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin-id', email: 'pierre@example.com', ...claims })}.signature`;
}

export const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s;
