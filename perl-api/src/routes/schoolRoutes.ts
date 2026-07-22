import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createSchoolController } from '../controllers/schoolController.js';

export const createSchoolRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createSchoolController(repositories);

  router.get('/school/current', controller.getCurrentSchool);

  return router;
};
