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
  /** Encrypted, certificate-checked connection, for hosted databases such as Neon. */
  DATABASE_SSL: boolean;
  JWT_SECRET: string;
  PASSWORD_PEPPER: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  /** Shared with nginx when it reaches the backend over a public address (see TrustedProxyGuard). */
  PROXY_SECRET?: string;
  /** Google Gemini API key of the "Ask my resume" assistant; '' (unset or blank) = unavailable. */
  GEMINI_API_KEY: string;
  /** Gemini models to try, in order (the first one that answers is kept for the next questions). */
  GEMINI_MODEL: string[];
  /** Input + output tokens per UTC month; above it the assistant answers 503. */
  ASSISTANT_MONTHLY_TOKEN_LIMIT: number;
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
    DATABASE_SSL: false,
    JWT_SECRET: '',
    PASSWORD_PEPPER: '',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
    ASSISTANT_MONTHLY_TOKEN_LIMIT: 2_000_000,
  };

  // The "Ask my resume" assistant: optional, unavailable without a key.
  const geminiApiKey = read('GEMINI_API_KEY');
  if (geminiApiKey !== undefined && !/^\S{20,200}$/.test(geminiApiKey)) {
    errors.push('GEMINI_API_KEY must be 20 to 200 characters, without spaces');
  }
  const geminiModel = read('GEMINI_MODEL');
  const geminiModels = (geminiModel ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model !== '');
  if (geminiModels.length > 0) {
    if (
      geminiModels.length <= 5 &&
      new Set(geminiModels).size === geminiModels.length &&
      geminiModels.every((model) => /^[a-z0-9][a-z0-9.-]{0,63}$/.test(model))
    ) {
      env.GEMINI_MODEL = geminiModels;
    } else {
      errors.push(
        'GEMINI_MODEL must be 1 to 5 different model names separated by commas, such as gemini-3.6-flash,gemini-3.8-flash',
      );
    }
  }
  const tokenLimit = read('ASSISTANT_MONTHLY_TOKEN_LIMIT');
  if (tokenLimit !== undefined) {
    // The monthly totals are int columns: keep the limit below their maximum.
    const n = Number(tokenLimit);
    if (/^\d+$/.test(tokenLimit) && n >= 1 && n <= 2_147_483_647) {
      env.ASSISTANT_MONTHLY_TOKEN_LIMIT = n;
    } else {
      errors.push('ASSISTANT_MONTHLY_TOKEN_LIMIT must be an integer between 1 and 2147483647');
    }
  }

  const databaseSsl = read('DATABASE_SSL')?.toLowerCase();
  if (databaseSsl !== undefined && databaseSsl !== 'true' && databaseSsl !== 'false') {
    errors.push('DATABASE_SSL must be "true" or "false"');
  }
  env.DATABASE_SSL = databaseSsl === 'true';

  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters (e.g. `openssl rand -base64 48`)');
  }

  const passwordPepper = required('PASSWORD_PEPPER');
  if (passwordPepper && passwordPepper.length < 32) {
    errors.push('PASSWORD_PEPPER must be at least 32 characters (e.g. `openssl rand -base64 48`)');
  } else if (passwordPepper && passwordPepper === jwtSecret) {
    errors.push('PASSWORD_PEPPER must be different from JWT_SECRET');
  }

  // Admin credentials are optional, but go together (see AdminAccountService).
  const adminEmail = read('ADMIN_EMAIL')?.toLowerCase();
  const adminPassword =
    typeof raw['ADMIN_PASSWORD'] === 'string' && raw['ADMIN_PASSWORD'] !== ''
      ? raw['ADMIN_PASSWORD']
      : undefined;
  if (adminEmail !== undefined && adminPassword === undefined) {
    errors.push('ADMIN_PASSWORD is required when ADMIN_EMAIL is set');
  }
  if (adminPassword !== undefined && adminEmail === undefined) {
    errors.push('ADMIN_EMAIL is required when ADMIN_PASSWORD is set');
  }
  if (adminEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    errors.push('ADMIN_EMAIL must be a valid email address');
  }
  if (adminPassword !== undefined && adminPassword.length < 12) {
    errors.push('ADMIN_PASSWORD must be at least 12 characters');
  }

  // Optional: only set where nginx reaches the backend through a public address (e.g. Render).
  const proxySecret = read('PROXY_SECRET');
  if (proxySecret !== undefined && proxySecret.length < 32) {
    errors.push('PROXY_SECRET must be at least 32 characters (e.g. `openssl rand -base64 48`)');
  } else if (proxySecret !== undefined && !/^[A-Za-z0-9+/=_-]+$/.test(proxySecret)) {
    // nginx writes it into its config: no quotes, spaces, `;` or `$`.
    errors.push('PROXY_SECRET may only contain letters, digits and + / = _ - (base64 or hex)');
  } else if (proxySecret !== undefined && [jwtSecret, passwordPepper].includes(proxySecret)) {
    errors.push('PROXY_SECRET must be different from JWT_SECRET and PASSWORD_PEPPER');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
  env.JWT_SECRET = jwtSecret;
  env.PASSWORD_PEPPER = passwordPepper;
  if (adminEmail !== undefined && adminPassword !== undefined) {
    env.ADMIN_EMAIL = adminEmail;
    env.ADMIN_PASSWORD = adminPassword;
  }
  if (proxySecret !== undefined) env.PROXY_SECRET = proxySecret;
  // Always set (never undefined), so ConfigService never falls back to a blank `process.env` value.
  env.GEMINI_API_KEY = geminiApiKey ?? '';
  return env;
}
