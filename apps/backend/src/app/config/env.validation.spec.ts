import { validateEnv } from './env.validation';

const db = {
  DATABASE_HOST: 'postgres',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'app',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'resume',
  JWT_SECRET: 'x'.repeat(32),
  PASSWORD_PEPPER: 'p'.repeat(32),
};

describe('validateEnv', () => {
  it('returns typed values from DATABASE_* variables', () => {
    expect(validateEnv({ ...db, PORT: '3000', NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_HOST: 'postgres',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'app',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'resume',
      JWT_SECRET: 'x'.repeat(32),
      PASSWORD_PEPPER: 'p'.repeat(32),
    });
  });

  it('applies defaults for NODE_ENV, PORT, DATABASE_HOST and DATABASE_PORT', () => {
    const env = validateEnv({
      DATABASE_USER: 'app',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'resume',
      JWT_SECRET: 'x'.repeat(32),
      PASSWORD_PEPPER: 'p'.repeat(32),
    });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_HOST).toBe('localhost');
    expect(env.DATABASE_PORT).toBe(5432);
  });

  it('falls back to the POSTGRES_* variables of the root .env for local development', () => {
    const env = validateEnv({
      POSTGRES_USER: 'pg-user',
      POSTGRES_PASSWORD: 'pg-pass',
      POSTGRES_DB: 'pg-db',
      POSTGRES_PORT: '5433',
      BACKEND_PORT: '3003',
      JWT_SECRET: 'x'.repeat(32),
      PASSWORD_PEPPER: 'p'.repeat(32),
    });
    expect(env).toMatchObject({
      DATABASE_USER: 'pg-user',
      DATABASE_PASSWORD: 'pg-pass',
      DATABASE_NAME: 'pg-db',
      DATABASE_PORT: 5433,
      PORT: 3003,
    });
  });

  it('prefers DATABASE_* and PORT over the POSTGRES_* / BACKEND_PORT fallbacks', () => {
    const env = validateEnv({
      ...db,
      PORT: '3000',
      POSTGRES_USER: 'other',
      POSTGRES_PORT: '9999',
      BACKEND_PORT: '3003',
    });
    expect(env.DATABASE_USER).toBe('app');
    expect(env.DATABASE_PORT).toBe(5432);
    expect(env.PORT).toBe(3000);
  });

  it('throws one error listing every missing required variable', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_USER.*DATABASE_PASSWORD.*DATABASE_NAME.*JWT_SECRET.*PASSWORD_PEPPER/s,
    );
  });

  it('treats empty strings as missing', () => {
    expect(() => validateEnv({ ...db, DATABASE_PASSWORD: '' })).toThrow(/DATABASE_PASSWORD/);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '70000'],
    ['DATABASE_PORT', '54.32'],
  ])('rejects an invalid %s (%s)', (name, value) => {
    expect(() => validateEnv({ ...db, [name]: value })).toThrow(new RegExp(name));
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...db, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('never includes secret values in error messages', () => {
    try {
      validateEnv({ ...db, DATABASE_PASSWORD: 'super-secret', PORT: 'nope' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain('super-secret');
    }
  });

  describe('auth settings', () => {
    it('requires a JWT_SECRET of at least 32 characters', () => {
      expect(() => validateEnv({ ...db, JWT_SECRET: undefined })).toThrow(/JWT_SECRET is required/);
      expect(() => validateEnv({ ...db, JWT_SECRET: 'too-short' })).toThrow(
        /JWT_SECRET must be at least 32 characters/,
      );
    });

    it('requires a PASSWORD_PEPPER of at least 32 characters, different from JWT_SECRET', () => {
      expect(() => validateEnv({ ...db, PASSWORD_PEPPER: undefined })).toThrow(
        /PASSWORD_PEPPER is required/,
      );
      expect(() => validateEnv({ ...db, PASSWORD_PEPPER: 'short' })).toThrow(
        /PASSWORD_PEPPER must be at least 32 characters/,
      );
      expect(() => validateEnv({ ...db, PASSWORD_PEPPER: db.JWT_SECRET })).toThrow(
        /PASSWORD_PEPPER must be different from JWT_SECRET/,
      );
      expect(validateEnv(db).PASSWORD_PEPPER).toBe('p'.repeat(32));
    });

    it('never includes the pepper in error messages', () => {
      try {
        validateEnv({ ...db, PASSWORD_PEPPER: 'my-tiny-pepper' });
        expect.unreachable();
      } catch (e) {
        expect(String(e)).not.toContain('my-tiny-pepper');
      }
    });

    it('accepts no admin credentials (the existing admin account is kept as is)', () => {
      const env = validateEnv(db);
      expect(env.ADMIN_EMAIL).toBeUndefined();
      expect(env.ADMIN_PASSWORD).toBeUndefined();
    });

    it('returns the admin credentials, with the email trimmed and lowercased', () => {
      const env = validateEnv({
        ...db,
        ADMIN_EMAIL: '  Pierre@Example.COM ',
        ADMIN_PASSWORD: 'a-long-enough-password',
      });
      expect(env.ADMIN_EMAIL).toBe('pierre@example.com');
      expect(env.ADMIN_PASSWORD).toBe('a-long-enough-password');
    });

    it('requires ADMIN_EMAIL and ADMIN_PASSWORD together', () => {
      expect(() => validateEnv({ ...db, ADMIN_EMAIL: 'a@b.co' })).toThrow(/ADMIN_PASSWORD/);
      expect(() => validateEnv({ ...db, ADMIN_PASSWORD: 'a-long-enough-password' })).toThrow(
        /ADMIN_EMAIL/,
      );
    });

    it('rejects an invalid ADMIN_EMAIL and an ADMIN_PASSWORD shorter than 12 characters', () => {
      expect(() =>
        validateEnv({
          ...db,
          ADMIN_EMAIL: 'not-an-email',
          ADMIN_PASSWORD: 'a-long-enough-password',
        }),
      ).toThrow(/ADMIN_EMAIL must be a valid email/);
      expect(() => validateEnv({ ...db, ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'short' })).toThrow(
        /ADMIN_PASSWORD must be at least 12 characters/,
      );
    });

    it('never includes the secret or the admin password in error messages', () => {
      try {
        validateEnv({
          ...db,
          JWT_SECRET: 'short-secret',
          ADMIN_EMAIL: 'x',
          ADMIN_PASSWORD: 'tiny',
        });
        expect.unreachable();
      } catch (e) {
        expect(String(e)).not.toContain('short-secret');
        expect(String(e)).not.toContain('tiny');
      }
    });
  });
});
