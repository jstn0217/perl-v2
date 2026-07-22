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

export const env = {
  port: resolvePort(process.env.PORT),
  dataLayer: resolveDataLayer(process.env.DATA_LAYER),
  allowedOrigins: resolveAllowedOrigins(process.env.ALLOWED_ORIGINS)
};
