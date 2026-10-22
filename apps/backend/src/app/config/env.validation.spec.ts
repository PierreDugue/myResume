import { validateEnv } from './env.validation';

const db = {
  DATABASE_HOST: 'postgres',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'app',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'resume',
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
    });
  });

  it('applies defaults for NODE_ENV, PORT, DATABASE_HOST and DATABASE_PORT', () => {
    const env = validateEnv({
      DATABASE_USER: 'app',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'resume',
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
    expect(() => validateEnv({})).toThrow(/DATABASE_USER.*DATABASE_PASSWORD.*DATABASE_NAME/s);
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
});
