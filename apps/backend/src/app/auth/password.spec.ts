import { hashPassword, verifyPassword } from './password';

const PEPPER = 'server-side-pepper-at-least-32-characters';

describe('password hashing (bcrypt with salt, plus a pepper)', () => {
  it('produces a bcrypt hash (cost 12) that contains neither the password nor the pepper', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER);
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain('correct horse');
    expect(hash).not.toContain(PEPPER);
  });

  it('salts each hash: the same password gives different hashes', async () => {
    expect(await hashPassword('same-password-123', PEPPER)).not.toBe(
      await hashPassword('same-password-123', PEPPER),
    );
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER);
    expect(await verifyPassword('correct horse battery staple', hash, PEPPER)).toBe(true);
    expect(await verifyPassword('wrong password', hash, PEPPER)).toBe(false);
  });

  it('peppers the hash: without the right pepper the password cannot be verified', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER);
    expect(
      await verifyPassword(
        'correct horse battery staple',
        hash,
        'another-pepper-also-32-characters!!',
      ),
    ).toBe(false);
  });

  it('is not a plain bcrypt hash of the password (a stolen database alone is not enough)', async () => {
    const { compare } = await import('bcryptjs');
    const hash = await hashPassword('correct horse battery staple', PEPPER);
    expect(await compare('correct horse battery staple', hash)).toBe(false);
  });

  it('uses the whole password, even beyond bcrypt’s 72-byte limit', async () => {
    const base = 'x'.repeat(80);
    const hash = await hashPassword(`${base}-one`, PEPPER);
    expect(await verifyPassword(`${base}-two`, hash, PEPPER)).toBe(false);
    expect(await verifyPassword(`${base}-one`, hash, PEPPER)).toBe(true);
  });

  it('returns false (no exception) for a malformed hash', async () => {
    expect(await verifyPassword('anything', 'not-a-hash', PEPPER)).toBe(false);
  });
});
