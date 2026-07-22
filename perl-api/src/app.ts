import express from 'express';
import { createHealthRoutes } from './routes/healthRoutes.js';
import type { RepositorySet } from './repositories/index.js';

export const createApp = (repositories: RepositorySet) => {
  const app = express();

  app.use(express.json());
  app.use('/api', createHealthRoutes(repositories));

  return app;
};
