import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createHealthController } from '../controllers/healthController.js';

export const createHealthRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createHealthController(repositories);

  router.get('/health', controller.getHealth);

  return router;
};
