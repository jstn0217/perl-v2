export type DataLayer = 'mock' | 'db';

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const resolveDataLayer = (value: string | undefined): DataLayer => {
  return value === 'db' ? 'db' : 'mock';
};

const resolvePort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '4000', 10);

  return Number.isNaN(parsed) ? 4000 : parsed;
};

const resolveAllowedOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return defaultAllowedOrigins;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const resolveBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
};

const resolvePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const env = {
  port: resolvePort(process.env.PORT),
  dataLayer: resolveDataLayer(process.env.DATA_LAYER),
  allowedOrigins: resolveAllowedOrigins(process.env.ALLOWED_ORIGINS),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-phase-2-secret',
  jwtCookieName: process.env.JWT_COOKIE_NAME ?? 'perl_session',
  jwtExpiresInSeconds: resolvePositiveInteger(process.env.JWT_EXPIRES_IN_SECONDS, 60 * 60 * 8),
  cookieSecure: resolveBoolean(process.env.COOKIE_SECURE, false)
};
