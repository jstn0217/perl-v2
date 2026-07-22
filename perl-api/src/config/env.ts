export type DataLayer = 'mock' | 'db';

const resolveDataLayer = (value: string | undefined): DataLayer => {
  return value === 'db' ? 'db' : 'mock';
};

const resolvePort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '4000', 10);

  return Number.isNaN(parsed) ? 4000 : parsed;
};

export const env = {
  port: resolvePort(process.env.PORT),
  dataLayer: resolveDataLayer(process.env.DATA_LAYER)
};
