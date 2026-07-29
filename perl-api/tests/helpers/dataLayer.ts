import type { DataLayer } from '../../src/config/env.js';
import {
  closeRepositoryLayer,
  createRepositories,
  initializeRepositoryLayer,
  resetRepositoriesForTests
} from '../../src/repositories/index.js';

const validDataLayers: DataLayer[] = ['mock', 'db'];

export const getTestDataLayers = (): DataLayer[] => {
  const requested = (process.env.TEST_DATA_LAYERS ?? 'mock')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is DataLayer => validDataLayers.includes(value as DataLayer));

  return requested.length > 0 ? requested : ['mock'];
};

export const describeForDataLayers = (
  title: string,
  suite: (dataLayer: DataLayer) => void | Promise<void>
) => {
  for (const dataLayer of getTestDataLayers()) {
    describe(`${title} [${dataLayer}]`, () => {
      beforeAll(async () => {
        await initializeRepositoryLayer(dataLayer);
      }, 30_000);

      beforeEach(async () => {
        await resetRepositoriesForTests(dataLayer);
      }, 30_000);

      afterAll(async () => {
        await closeRepositoryLayer(dataLayer);
      }, 30_000);

      suite(dataLayer);
    });
  }
};

export { createRepositories };
