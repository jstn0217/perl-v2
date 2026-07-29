import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createSchoolController } from '../controllers/schoolController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AuthService } from '../services/AuthService.js';

export const createSchoolRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createSchoolController(repositories);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );

  router.get('/school/current', requireAuth(authService), controller.getCurrentSchool);

  return router;
};
