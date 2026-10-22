const NODE_ENVS = ['development', 'production', 'test'] as const;

/** Validated, typed configuration of the backend. */
export interface AppEnv {
  NODE_ENV: (typeof NODE_ENVS)[number];
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
}

/**
 * Validates the environment and returns typed values (used by `ConfigModule.forRoot({ validate })`).
 *
 * `DATABASE_*` and `PORT` are what Docker Compose sets. For local development the values fall back to
 * the `POSTGRES_*` / `BACKEND_PORT` variables of the root `.env`, so secrets are not duplicated.
 * Throws a single error listing every problem; error messages never contain values.
 */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const read = (...names: string[]): string | undefined => {
    for (const name of names) {
      const value = raw[name];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return undefined;
  };
  const required = (name: string, ...fallbacks: string[]): string => {
    const value = read(name, ...fallbacks);
    if (value === undefined) errors.push(`${name} is required`);
    return value ?? '';
  };
  const port = (name: string, fallbacks: string[], defaultValue: number): number => {
    const value = read(name, ...fallbacks);
    if (value === undefined) return defaultValue;
    const n = Number(value);
    if (!/^\d+$/.test(value) || n < 1 || n > 65535) {
      errors.push(`${name} must be an integer between 1 and 65535`);
    }
    return n;
  };

  const nodeEnv = read('NODE_ENV') ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
  }

  const env: AppEnv = {
    NODE_ENV: nodeEnv as AppEnv['NODE_ENV'],
    PORT: port('PORT', ['BACKEND_PORT'], 3000),
    DATABASE_HOST: read('DATABASE_HOST') ?? 'localhost',
    DATABASE_PORT: port('DATABASE_PORT', ['POSTGRES_PORT'], 5432),
    DATABASE_USER: required('DATABASE_USER', 'POSTGRES_USER'),
    DATABASE_PASSWORD: required('DATABASE_PASSWORD', 'POSTGRES_PASSWORD'),
    DATABASE_NAME: required('DATABASE_NAME', 'POSTGRES_DB'),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
  return env;
}
