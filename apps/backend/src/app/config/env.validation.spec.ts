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
      DATABASE_SSL: false,
      JWT_SECRET: 'x'.repeat(32),
      PASSWORD_PEPPER: 'p'.repeat(32),
      GEMINI_API_KEY: '',
      GEMINI_MODEL: ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
      ASSISTANT_MONTHLY_TOKEN_LIMIT: 2000000,
    });
  });

  describe('DATABASE_SSL', () => {
    it('defaults to false, for the local and Docker databases', () => {
      expect(validateEnv(db).DATABASE_SSL).toBe(false);
      expect(validateEnv({ ...db, DATABASE_SSL: '' }).DATABASE_SSL).toBe(false);
    });

    it('is true when set to "true", for hosted databases such as Neon', () => {
      expect(validateEnv({ ...db, DATABASE_SSL: 'true' }).DATABASE_SSL).toBe(true);
      expect(validateEnv({ ...db, DATABASE_SSL: ' TRUE ' }).DATABASE_SSL).toBe(true);
    });

    it('is false when set to "false"', () => {
      expect(validateEnv({ ...db, DATABASE_SSL: 'false' }).DATABASE_SSL).toBe(false);
    });

    it('rejects any other value instead of guessing', () => {
      expect(() => validateEnv({ ...db, DATABASE_SSL: 'yes' })).toThrow(
        'DATABASE_SSL must be "true" or "false"',
      );
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

    it('accepts no PROXY_SECRET (the backend is only reached through a private network)', () => {
      expect(validateEnv(db).PROXY_SECRET).toBeUndefined();
    });

    it('returns a PROXY_SECRET of at least 32 characters', () => {
      expect(validateEnv({ ...db, PROXY_SECRET: 's'.repeat(32) }).PROXY_SECRET).toBe(
        's'.repeat(32),
      );
    });

    it('rejects a PROXY_SECRET that is too short or reuses another secret', () => {
      expect(() => validateEnv({ ...db, PROXY_SECRET: 'short' })).toThrow(
        /PROXY_SECRET must be at least 32 characters/,
      );
      expect(() => validateEnv({ ...db, PROXY_SECRET: db.JWT_SECRET })).toThrow(
        /PROXY_SECRET must be different from JWT_SECRET and PASSWORD_PEPPER/,
      );
      expect(() => validateEnv({ ...db, PROXY_SECRET: db.PASSWORD_PEPPER })).toThrow(
        /PROXY_SECRET must be different from JWT_SECRET and PASSWORD_PEPPER/,
      );
    });

    it('only accepts base64/hex characters in PROXY_SECRET (it is written into the nginx config)', () => {
      expect(() => validateEnv({ ...db, PROXY_SECRET: `${'s'.repeat(32)}";` })).toThrow(
        /PROXY_SECRET may only contain/,
      );
      expect(() => validateEnv({ ...db, PROXY_SECRET: `${'s'.repeat(32)} $x` })).toThrow(
        /PROXY_SECRET may only contain/,
      );
      const base64 = 'Ab0+/='.repeat(6);
      expect(validateEnv({ ...db, PROXY_SECRET: base64 }).PROXY_SECRET).toBe(base64);
    });

    it('never includes the proxy secret in error messages', () => {
      let error: unknown;
      try {
        validateEnv({ ...db, PROXY_SECRET: 'tiny-proxy-secret' });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain('tiny-proxy-secret');
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

  describe('assistant settings', () => {
    const KEY = 'k'.repeat(39);

    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['only spaces', '   '],
      ['only a newline and tabs', '\n\t '],
    ])(
      'gives an empty GEMINI_API_KEY (never undefined) when it is %s: the assistant is then unavailable',
      (_name, value) => {
        expect(validateEnv({ ...db, GEMINI_API_KEY: value }).GEMINI_API_KEY).toBe('');
      },
    );

    it('returns a GEMINI_API_KEY of 20 to 200 characters', () => {
      expect(validateEnv({ ...db, GEMINI_API_KEY: KEY }).GEMINI_API_KEY).toBe(KEY);
      expect(validateEnv({ ...db, GEMINI_API_KEY: 'k'.repeat(20) }).GEMINI_API_KEY).toBeDefined();
      expect(validateEnv({ ...db, GEMINI_API_KEY: 'k'.repeat(200) }).GEMINI_API_KEY).toBeDefined();
    });

    it.each([
      ['too short', 'k'.repeat(19)],
      ['too long', 'k'.repeat(201)],
      ['containing a space', `${'k'.repeat(15)} ${'k'.repeat(15)}`],
      ['containing a newline', `${'k'.repeat(15)}\n${'k'.repeat(15)}`],
    ])('rejects a GEMINI_API_KEY %s, without printing it', (_name, value) => {
      let message = '';
      try {
        validateEnv({ ...db, GEMINI_API_KEY: value });
      } catch (e) {
        message = String(e);
      }
      expect(message).toMatch(/GEMINI_API_KEY/);
      expect(message).not.toContain(value);
    });

    const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];

    it('defaults GEMINI_MODEL to the fallback list, in order', () => {
      expect(validateEnv(db).GEMINI_MODEL).toEqual(DEFAULT_MODELS);
      expect(validateEnv({ ...db, GEMINI_MODEL: '' }).GEMINI_MODEL).toEqual(DEFAULT_MODELS);
      expect(validateEnv({ ...db, GEMINI_MODEL: ' , ' }).GEMINI_MODEL).toEqual(DEFAULT_MODELS);
    });

    it.each(['gemini-3-flash', 'gemini-2.5-pro', 'g', 'a1.b-c'])(
      'accepts GEMINI_MODEL %s',
      (model) => {
        expect(validateEnv({ ...db, GEMINI_MODEL: model }).GEMINI_MODEL).toEqual([model]);
      },
    );

    it('reads GEMINI_MODEL as a comma-separated list, trimmed, in order', () => {
      expect(
        validateEnv({ ...db, GEMINI_MODEL: ' gemini-b , gemini-a,,gemini-c ' }).GEMINI_MODEL,
      ).toEqual(['gemini-b', 'gemini-a', 'gemini-c']);
    });

    it('rejects a GEMINI_MODEL list with more than 5 models or a repeated model', () => {
      expect(() => validateEnv({ ...db, GEMINI_MODEL: 'a,b,c,d,e,f' })).toThrow(/GEMINI_MODEL/);
      expect(validateEnv({ ...db, GEMINI_MODEL: 'a,b,c,d,e' }).GEMINI_MODEL).toHaveLength(5);
      expect(() => validateEnv({ ...db, GEMINI_MODEL: 'a,b,a' })).toThrow(/GEMINI_MODEL/);
    });

    it('rejects a GEMINI_MODEL list with one invalid name', () => {
      expect(() => validateEnv({ ...db, GEMINI_MODEL: 'gemini-a,models/gemini' })).toThrow(
        /GEMINI_MODEL/,
      );
    });

    it.each([
      'Gemini-Flash',
      '-flash',
      '.flash',
      'models/gemini',
      'gemini flash',
      `g${'a'.repeat(64)}`,
    ])('rejects GEMINI_MODEL %s', (model) => {
      expect(() => validateEnv({ ...db, GEMINI_MODEL: model })).toThrow(/GEMINI_MODEL/);
    });

    it('defaults ASSISTANT_MONTHLY_TOKEN_LIMIT to 2000000', () => {
      expect(validateEnv(db).ASSISTANT_MONTHLY_TOKEN_LIMIT).toBe(2000000);
      expect(
        validateEnv({ ...db, ASSISTANT_MONTHLY_TOKEN_LIMIT: '' }).ASSISTANT_MONTHLY_TOKEN_LIMIT,
      ).toBe(2000000);
    });

    it('accepts the largest limit the database int column holds, and no more', () => {
      expect(
        validateEnv({ ...db, ASSISTANT_MONTHLY_TOKEN_LIMIT: '2147483647' })
          .ASSISTANT_MONTHLY_TOKEN_LIMIT,
      ).toBe(2147483647);
    });

    it('reads ASSISTANT_MONTHLY_TOKEN_LIMIT as a number', () => {
      expect(
        validateEnv({ ...db, ASSISTANT_MONTHLY_TOKEN_LIMIT: '500000' })
          .ASSISTANT_MONTHLY_TOKEN_LIMIT,
      ).toBe(500000);
      expect(
        validateEnv({ ...db, ASSISTANT_MONTHLY_TOKEN_LIMIT: '1' }).ASSISTANT_MONTHLY_TOKEN_LIMIT,
      ).toBe(1);
    });

    it.each(['0', '-5', '1.5', 'lots', '1e6', '12 000', '2147483648'])(
      'rejects ASSISTANT_MONTHLY_TOKEN_LIMIT %s',
      (limit) => {
        expect(() => validateEnv({ ...db, ASSISTANT_MONTHLY_TOKEN_LIMIT: limit })).toThrow(
          /ASSISTANT_MONTHLY_TOKEN_LIMIT/,
        );
      },
    );
  });
});
